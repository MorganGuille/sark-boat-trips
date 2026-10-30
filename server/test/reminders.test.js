// The reminder email at 6pm (Guernsey time) the evening before each trip (spec P2-7), with a fixed clock.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { runDueReminders, MAX_ATTEMPTS } = require('../utils/reminders');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Types } = require('mongoose');

// Summer: Guernsey is an hour ahead of UTC, so 6pm there is 17:00 UTC
const SUMMER_6PM = new Date('2027-07-14T17:00:00Z');
const TOMORROW = '2027-07-15';
const minutes = (date, n) => new Date(date.getTime() + n * 60000);

// A booking id records when it was made: this one says "made at `when`"
const idMadeAt = (when) => new Types.ObjectId(Math.floor(when.getTime() / 1000).toString(16).padStart(8, '0') + crypto.randomBytes(8).toString('hex'));
const insert = (fields = {}) => t.insertBooking({ _id: idMadeAt(new Date('2027-07-01T10:00:00Z')), date: TOMORROW, email: `${fields.firstName || 'guest'}@example.test`.toLowerCase(), ...fields });
const reminders = () => mocks.sent().filter((m) => /^See you tomorrow/.test(m.subject));

let token;
before(async () => { await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); mocks.reset(); });

describe('when reminders are sent', () => {
    it('at 6pm Guernsey time the evening before, to every booking for tomorrow, and not before', async () => {
        await insert({ firstName: 'Ann', timeslot: '11am' });
        await insert({ firstName: 'Bob', timeslot: '2pm' });
        await insert({ firstName: 'Today', date: '2027-07-14' });
        await insert({ firstName: 'Later', date: '2027-07-16' });

        assert.deepEqual(await runDueReminders(minutes(SUMMER_6PM, -1)), { sent: 0, failed: 0 }, '5.59pm: not yet');
        assert.deepEqual(await runDueReminders(SUMMER_6PM), { sent: 2, failed: 0 });
        assert.deepEqual(reminders().map((m) => [m.to, m.subject]).sort(), [
            ['ann@example.test', 'See you tomorrow at 11am'],
            ['bob@example.test', 'See you tomorrow at 2pm'],
        ]);
    });

    it('in winter 6pm is 18:00 UTC', async () => {
        await insert({ firstName: 'Win', date: '2027-01-11', _id: idMadeAt(new Date('2026-12-01T10:00:00Z')) });
        assert.equal((await runDueReminders(new Date('2027-01-10T17:59:00Z'))).sent, 0);
        assert.equal((await runDueReminders(new Date('2027-01-10T18:00:00Z'))).sent, 1);
    });

    it('only once, however many times the check runs (and not after the trip day has started)', async () => {
        const id = await insert({ firstName: 'Ann' });
        await runDueReminders(SUMMER_6PM);
        await runDueReminders(minutes(SUMMER_6PM, 1));
        await runDueReminders(minutes(SUMMER_6PM, 60));
        assert.equal(reminders().length, 1);
        assert.ok((await t.findBooking(id)).reminderSentAt instanceof Date);
    });

    it('only once even when two checks run at the same moment', async () => {
        await insert({ firstName: 'Ann' });
        await insert({ firstName: 'Bob' });
        await Promise.all([runDueReminders(SUMMER_6PM), runDueReminders(SUMMER_6PM)]);
        assert.deepEqual(reminders().map((m) => m.to).sort(), ['ann@example.test', 'bob@example.test']);
    });

    it('a reminder missed in the evening (server down) is not sent the next morning', async () => {
        await insert({ firstName: 'Ann' });
        assert.equal((await runDueReminders(new Date('2027-07-15T06:00:00Z'))).sent, 0);
    });
});

describe('who gets one', () => {
    it('online and dashboard bookings, trips and charters; not cancelled bookings or ones without an email', async () => {
        await insert({ firstName: 'Online', paymentStatus: 'card_saved' });
        await insert({ firstName: 'Dashboard' });
        await insert({ firstName: 'Charter', charter: 'true' });
        await insert({ firstName: 'Cancelled', status: 'cancelled' });
        await insert({ firstName: 'NoEmail', email: '' });
        await insert({ firstName: 'NullEmail', email: null });
        await runDueReminders(SUMMER_6PM);
        assert.deepEqual(reminders().map((m) => m.to).sort(), ['charter@example.test', 'dashboard@example.test', 'online@example.test']);
    });

    it('not a booking made after 6pm for the next day: it has only just had its confirmation', async () => {
        await insert({ firstName: 'Early', _id: idMadeAt(minutes(SUMMER_6PM, -30)) });
        await insert({ firstName: 'Late', _id: idMadeAt(minutes(SUMMER_6PM, 30)) });
        await runDueReminders(minutes(SUMMER_6PM, 45));
        assert.deepEqual(reminders().map((m) => m.to), ['early@example.test']);
    });

    it('a booking moved to another day gets a reminder for the new day', async () => {
        const id = await insert({ firstName: 'Mover' });
        await runDueReminders(SUMMER_6PM);
        const res = await t.call(app, 'post', `/bookings/update/${id}`, { token, body: { date: '2027-07-20', notifyCustomer: false } });
        assert.equal(res.body.ok, true, res.body.data);
        assert.equal((await t.findBooking(id)).reminderSentAt, undefined);
        mocks.reset();
        assert.equal((await runDueReminders(new Date('2027-07-19T17:00:00Z'))).sent, 1);
    });
});

describe('the email', () => {
    it('gives the day, time, party, where to be, and how to get in touch, from MAIL_FROM', async () => {
        await insert({ firstName: 'Ann', adults: 2, children: 1, infants: 1, timeslot: '2pm' });
        await runDueReminders(SUMMER_6PM);
        const [mail] = reminders();
        assert.equal(mail.from, `Sark Boat Trips <${t.MAIL_FROM}>`);
        const { text } = mail;
        assert.match(text, /Dear Ann,/);
        assert.match(text, /Just a reminder that your boat trip is tomorrow\./);
        assert.match(text, /Date: Thursday 15 July 2027\nTime: 2pm\nMeeting point: Creux Harbour, Sark \(https:\/\/maps\.app\.goo\.gl\/E2XLJqrGku7eDePZ8\)\nParty: 2 adults, 1 child and 1 infant\n/);
        assert.match(text, /Creux Harbour shortly before 2pm/);
        assert.match(text, /Bring weather appropriate clothing, and any snacks and drinks you'd like\./);
        assert.match(text, /the weather means we have to change the time of a trip\. If that happens, we'll contact you/);
        assert.ok(mail.html.includes(`href="mailto:${t.MAIL_FROM}"`));
        assert.doesNotMatch(text, /charged|£/, 'no payment line (owner\'s choice)');
    });

    it('says private charter for a charter', async () => {
        await insert({ firstName: 'Cee', charter: 'true' });
        await runDueReminders(SUMMER_6PM);
        assert.match(reminders()[0].text, /your private charter is tomorrow/);
    });

    it('escapes what the customer typed', async () => {
        await insert({ firstName: '<b>Eve</b>' });
        await runDueReminders(SUMMER_6PM);
        assert.ok(reminders()[0].html.includes('&lt;b&gt;Eve&lt;/b&gt;'));
    });
});

describe('when the email fails', () => {
    it(`is tried again a minute later, ${MAX_ATTEMPTS} times in all, then given up`, async () => {
        const id = await insert({ firstName: 'Ann' });
        mocks.mailMode = 'all';
        for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await runDueReminders(minutes(SUMMER_6PM, i));
        assert.equal(mocks.mails.length, MAX_ATTEMPTS);
        const saved = await t.findBooking(id);
        assert.equal(saved.reminderSentAt, undefined);
        assert.equal(saved.reminderAttempts, MAX_ATTEMPTS);
    });

    it('goes through on a later try', async () => {
        const id = await insert({ firstName: 'Ann' });
        mocks.mailMode = 'all';
        assert.deepEqual(await runDueReminders(SUMMER_6PM), { sent: 0, failed: 1 });
        mocks.mailMode = 'none';
        assert.deepEqual(await runDueReminders(minutes(SUMMER_6PM, 1)), { sent: 1, failed: 0 });
        assert.ok((await t.findBooking(id)).reminderSentAt instanceof Date);
    });
});
