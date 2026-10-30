// Payment status on bookings and "Mark paid" on the dashboard (step 1 of paymentsspec.md: no Stripe yet).
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const markPaid = (_id) => t.call(app, 'post', '/bookings/mark-paid', { token, body: { _id } });
const markUnpaid = (_id) => t.call(app, 'post', '/bookings/mark-unpaid', { token, body: { _id } });
const dayView = async (date) => (await t.call(app, 'get', `/bookings/${date}?includeCancelled=true`, { token })).body.data;

describe('every booking starts unpaid', () => {
    it('online trips and charters start with the card saved; a dashboard booking starts unpaid', async () => {
        assert.ok((await t.bookOnline(app, t.booking({ date: t.day(10) }))).booking);
        assert.equal((await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(11), timeslot: '11am', adults: '2' } })).body.ok, true);
        assert.ok((await t.bookOnline(app, t.booking({ date: t.day(12) }), { kind: 'charter' })).booking);
        const all = await db.collection('bookings').find({}).sort({ date: 1 }).toArray();
        assert.deepEqual(all.map((b) => [b.charter, b.paymentStatus]), [['false', 'card_saved'], [undefined, 'unpaid'], ['true', 'card_saved']]);
    });
    it('the day view and search say what each booking is worth, from its saved prices', async () => {
        await t.insertBooking({ date: t.day(10), adults: 5, children: 1, lastName: 'Family', prices: { adult: 4000, child: 2500, charter: 40000 } });
        await t.insertBooking({ date: t.day(10), adults: 11, charter: 'true', lastName: 'Group', prices: { adult: 4000, child: 2500, charter: 40000 } });
        const due = Object.fromEntries((await dayView(t.day(10))).map((b) => [b.lastName, b.amountDue]));
        assert.deepEqual(due, { Family: 22500, Group: 40000 });
        const found = (await t.call(app, 'get', '/bookings/search/family', { token })).body.data;
        assert.equal(found[0].amountDue, 22500);
    });
    it('the amount is unknown (null) only if no prices exist anywhere', async () => {
        await db.collection('admins').updateOne({}, { $unset: { adultPrice: '', childPrice: '', charterPrice: '' } });
        await t.insertBooking({ date: t.day(10), adults: 2 });
        assert.equal((await dayView(t.day(10)))[0].amountDue, null);
    });
    it('editing a booking cannot change how it was paid', async () => {
        const id = await t.insertBooking({ date: t.day(10), adults: 2 });
        await t.call(app, 'post', `/bookings/update/${id}`, { token, body: { phone: '0999', paymentStatus: 'paid', amountPaid: 1, paidAt: '2020-01-01' } });
        const b = await t.findBooking(id);
        assert.equal(b.phone, '0999');
        assert.equal(b.paymentStatus, 'unpaid', 'still unpaid (saving fills in the default for a booking that had none)');
        assert.equal(b.amountPaid, undefined);
    });
});

describe('mark paid in person', () => {
    it('an unpaid booking is marked paid with the time and the amount, and the message says how much', async () => {
        const id = await t.insertBooking({ date: t.day(10), adults: 5, children: 1, firstName: 'Ann', lastName: 'Smith' });
        const res = await markPaid(id);
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /Ann Smith on .* at 11am marked as paid in person \(£225\)/);
        const b = await t.findBooking(id);
        assert.equal(b.paymentStatus, 'paid_in_person');
        assert.equal(b.amountPaid, 22500);
        assert.ok(b.paidAt instanceof Date);
    });
    it('a booking made before payments existed (no status) counts as unpaid and can be marked', async () => {
        const id = await t.insertBooking({ date: t.day(10) });
        assert.equal((await markPaid(id)).body.ok, true);
    });
    it('a booking with a saved card can be marked paid instead, which stops the card being charged', async () => {
        const id = await t.insertBooking({ date: t.day(10), paymentStatus: 'card_saved', stripePaymentMethodId: 'pm_test' });
        assert.equal((await markPaid(id)).body.ok, true);
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid_in_person');
    });
    it('a failed-charge note is cleared once the money is taken', async () => {
        const id = await t.insertBooking({ date: t.day(10), paymentStatus: 'unpaid', paymentNote: 'The card was declined' });
        await markPaid(id);
        assert.equal((await t.findBooking(id)).paymentNote, undefined);
    });
    it('refuses a booking that is already paid, being charged right now, or cancelled', async () => {
        const paid = await t.insertBooking({ paymentStatus: 'paid' });
        const charging = await t.insertBooking({ paymentStatus: 'charging' });
        const cancelled = await t.insertBooking({ status: 'cancelled' });
        assert.match((await markPaid(paid)).body.data, /already paid/);
        assert.match((await markPaid(charging)).body.data, /being charged right now/);
        const res = await markPaid(cancelled);
        assert.equal(res.status, 409);
        assert.match(res.body.data, /Restore it/);
        assert.equal((await t.findBooking(paid)).paymentStatus, 'paid');
        assert.equal((await t.findBooking(charging)).paymentStatus, 'charging');
    });
    it('marking twice is refused the second time', async () => {
        const id = await t.insertBooking({});
        assert.equal((await markPaid(id)).status, 200);
        assert.equal((await markPaid(id)).status, 409);
    });
    it('an unknown or malformed id is a 404', async () => {
        assert.equal((await markPaid('64b000000000000000000000')).status, 404);
        assert.equal((await markPaid('nope')).status, 404);
        assert.equal((await markPaid({ $ne: null })).status, 404);
    });
});

describe('undo mark paid', () => {
    it('goes back to unpaid, and forgets the amount and time', async () => {
        const id = await t.insertBooking({});
        await markPaid(id);
        const res = await markUnpaid(id);
        assert.match(res.body.data, /marked as unpaid again/);
        const b = await t.findBooking(id);
        assert.equal(b.paymentStatus, 'unpaid');
        assert.equal(b.amountPaid, undefined);
        assert.equal(b.paidAt, undefined);
    });
    it('a booking with a saved card goes back to being charged at the trip time', async () => {
        const id = await t.insertBooking({ paymentStatus: 'card_saved', stripePaymentMethodId: 'pm_test' });
        await markPaid(id);
        const res = await markUnpaid(id);
        assert.match(res.body.data, /charged to the saved card/);
        assert.equal((await t.findBooking(id)).paymentStatus, 'card_saved');
    });
    it('a booking paid online cannot be undone here (that is a refund, in Stripe)', async () => {
        const id = await t.insertBooking({ paymentStatus: 'paid' });
        const res = await markUnpaid(id);
        assert.equal(res.status, 409);
        assert.match(res.body.data, /refund it in Stripe/);
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid');
    });
    it('a booking that was never marked paid is refused', async () => {
        assert.equal((await markUnpaid(await t.insertBooking({}))).status, 409);
    });
});

describe('the cancellation email says what happens to the money', () => {
    const cancel = (_id) => t.call(app, 'post', '/bookings/cancel', { token, body: { _id } });
    const mailTo = (who) => mocks.sent(who).find((m) => /cancelled/i.test(m.subject));
    const cases = [
        ['a saved card', { paymentStatus: 'card_saved', stripePaymentMethodId: 'pm_test' }, /Your card has not been charged, and it won't be charged for this booking/, /card saved, it will not be charged/],
        ['an unpaid booking', { paymentStatus: 'unpaid' }, /Nothing has been charged\./, /unpaid, nothing to refund/],
        ['a booking from before payments (no status)', {}, /Nothing has been charged\./, /unpaid, nothing to refund/],
        ['a booking paid online', { paymentStatus: 'paid' }, /If you've already paid, please get in touch and we'll sort out a refund/, /PAID ONLINE: refund it in Stripe/],
        ['a booking paid in person', { paymentStatus: 'paid_in_person' }, /If you've already paid/, /PAID IN PERSON/],
    ];
    for (const [name, fields, toCustomer, toOwner] of cases) {
        it(name, async () => {
            const id = await t.insertBooking({ email: 'bob@example.test', firstName: 'Bob', ...fields });
            assert.equal((await cancel(id)).body.ok, true);
            const decode = (html) => html.replace(/&#39;/g, "'");
            assert.match(decode(mailTo('bob@example.test').html), toCustomer);
            assert.match(decode(mailTo(t.OWNER).html), toOwner);
        });
    }
});
