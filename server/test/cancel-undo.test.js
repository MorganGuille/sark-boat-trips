// Cancel on the dashboard, and Undo (spec P3-6, owner's choice 3 Nov 2026): the booking is cancelled at
// once, but its emails wait about a minute, so Undo (a restore in that time) puts it back without the
// customer ever hearing about it.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { runDueCancelEmails, CANCEL_EMAIL_DELAY_MS, MAX_ATTEMPTS } = require('../utils/cancelEmails');

let token;
before(async () => {
    await t.startDb();
    token = await t.login(app);
});
after(() => t.stopDb());
beforeEach(async () => {
    await t.resetDb();
    mocks.reset();
});

const post = (path, body) => t.call(app, 'post', path, { token, body });
const cancel = (id) => post('/bookings/cancel', { _id: id });
const restore = (id) => post('/bookings/restore', { _id: id });
const booking = () => t.insertBooking({ date: t.day(10), firstName: 'Bob', email: 'bob@example.test', adults: 3 });
const later = (ms) => new Date(Date.now() + ms);
const cancelMails = () => mocks.sent().filter((m) => /cancelled/i.test(m.subject));

describe('the cancellation emails wait about a minute', () => {
    it('the booking is cancelled at once (seats free, not charged) but nobody is emailed yet', async () => {
        const id = await booking();
        const res = await cancel(id);
        assert.match(res.body.data, /cancelled\. The customer will be emailed in about a minute\.$/);
        const b = await t.findBooking(id);
        assert.equal(b.status, 'cancelled');
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 12);
        assert.equal(mocks.mails.length, 0);
        assert.deepEqual(await runDueCancelEmails(later(CANCEL_EMAIL_DELAY_MS - 5000)), { sent: 0, failed: 0 }, 'not before the minute is up');
        assert.equal(mocks.mails.length, 0);
    });

    it('after the minute the customer and the owner are emailed, once only', async () => {
        const id = await booking();
        await cancel(id);
        assert.deepEqual(await runDueCancelEmails(later(CANCEL_EMAIL_DELAY_MS + 1000)), { sent: 1, failed: 0 });
        assert.deepEqual(cancelMails().map((m) => m.to), ['bob@example.test', t.OWNER]);
        await runDueCancelEmails(later(5 * CANCEL_EMAIL_DELAY_MS));
        assert.equal(cancelMails().length, 2, 'not sent again');
        assert.equal((await t.findBooking(id)).cancelEmailDueAt, undefined);
    });

    it('two checks running at the same moment send it once', async () => {
        await cancel(await booking());
        const now = later(CANCEL_EMAIL_DELAY_MS + 1000);
        await Promise.all([runDueCancelEmails(now), runDueCancelEmails(now)]);
        assert.equal(cancelMails().length, 2);
    });

    it('a customer email that fails is tried again each minute, then the owner is told to contact them', async () => {
        const id = await booking();
        await cancel(id);
        mocks.mailMode = 'client';
        for (let i = 1; i < MAX_ATTEMPTS; i++) {
            assert.deepEqual(await runDueCancelEmails(later(i * CANCEL_EMAIL_DELAY_MS + 1000)), { sent: 0, failed: 1 }, `try ${i}`);
            assert.equal(mocks.sent(t.OWNER).length, 0, 'the owner waits until it is settled');
        }
        assert.deepEqual(await runDueCancelEmails(later(MAX_ATTEMPTS * CANCEL_EMAIL_DELAY_MS + 1000)), { sent: 1, failed: 0 });
        const [owner] = mocks.sent(t.OWNER);
        assert.match(owner.subject, /^Cancelled: .*CUSTOMER EMAIL FAILED/);
        assert.match(owner.text, /could not be sent, so please let them know/);
        assert.equal((await t.findBooking(id)).cancelEmailDueAt, undefined, 'given up');
    });

    it('a retry that then works sends the customer one email and the owner one', async () => {
        await cancel(await booking());
        mocks.mailMode = 'client';
        await runDueCancelEmails(later(CANCEL_EMAIL_DELAY_MS + 1000));
        mocks.mailMode = 'none';
        await runDueCancelEmails(later(2 * CANCEL_EMAIL_DELAY_MS + 1000));
        assert.deepEqual(cancelMails().map((m) => m.to), ['bob@example.test', t.OWNER]);
        assert.doesNotMatch(mocks.sent(t.OWNER)[0].subject, /FAILED/);
    });

    it('a booking with no email address: only the owner is emailed, after the minute', async () => {
        const id = await t.insertBooking({ date: t.day(10), firstName: 'Phone', email: '' });
        assert.match((await cancel(id)).body.data, /no email address, so the customer won't be told/);
        assert.equal(mocks.mails.length, 0);
        await t.sendCancelEmails();
        assert.deepEqual(mocks.sent().map((m) => m.to), [t.OWNER]);
    });
});

describe('Undo', () => {
    it('within the minute puts the booking back and nobody is ever emailed', async () => {
        const id = await booking();
        await cancel(id);
        const res = await restore(id);
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /put back\. Nobody was emailed\.$/);
        const b = await t.findBooking(id);
        assert.equal(b.status, 'active');
        assert.equal(b.cancelEmailDueAt, undefined);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 9);
        await runDueCancelEmails(later(10 * CANCEL_EMAIL_DELAY_MS));
        assert.equal(mocks.mails.length, 0, 'no cancellation, no new confirmation');
    });

    it('while a failed email waits for its retry, still nobody was told, so Undo is quiet', async () => {
        const id = await booking();
        await cancel(id);
        mocks.mailMode = 'all';
        await runDueCancelEmails(later(CANCEL_EMAIL_DELAY_MS + 1000));
        mocks.mailMode = 'none';
        mocks.reset();
        assert.match((await restore(id)).body.data, /Nobody was emailed/);
        await runDueCancelEmails(later(10 * CANCEL_EMAIL_DELAY_MS));
        assert.equal(mocks.mails.length, 0);
    });

    it('after the emails went, Restore sends a new confirmation, as before', async () => {
        const id = await booking();
        await cancel(id);
        await t.sendCancelEmails();
        mocks.reset();
        assert.match((await restore(id)).body.data, /restored and confirmation email sent/);
        assert.ok(mocks.sent('bob@example.test').some((m) => /is confirmed$/.test(m.subject)));
    });

    it('cancelled again after an Undo: the emails wait a fresh minute', async () => {
        const id = await booking();
        await cancel(id);
        await restore(id);
        await cancel(id);
        assert.equal(mocks.mails.length, 0);
        await t.sendCancelEmails();
        assert.equal(cancelMails().length, 2);
    });

    it('refused when the seats were taken meanwhile: still cancelled, and its emails still go', async () => {
        const id = await booking();
        await cancel(id);
        await t.insertBooking({ date: t.day(10), adults: 12 });
        const res = await restore(id);
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /only 0 spaces left/);
        await t.sendCancelEmails();
        assert.deepEqual(cancelMails().map((m) => m.to), ['bob@example.test', t.OWNER]);
    });
});

describe('deleted for good before the emails went', () => {
    it('sends them straight away, so the customer is still told', async () => {
        const id = await booking();
        await cancel(id);
        assert.match((await post('/bookings/permanently-delete', { _id: id })).body.data, /permanently deleted/);
        assert.deepEqual(cancelMails().map((m) => m.to), ['bob@example.test', t.OWNER]);
    });
});

describe('other cancels are unchanged', () => {
    it('a customer cancelling from their manage link is emailed at once', async () => {
        const manageToken = 'abcdefghijkmnpqrstuvwxyz23456789';
        await t.insertBooking({ date: t.day(10), firstName: 'Bob', email: 'bob@example.test', manageToken });
        const res = await t.call(app, 'post', `/bookings/manage/${manageToken}/cancel`, { body: {} });
        assert.equal(res.body.ok, true, JSON.stringify(res.body));
        assert.equal(cancelMails().length, 2);
    });
});
