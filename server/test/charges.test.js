// The charge at the trip time (paymentsspec.md, step 3). The timer itself only runs in the real
// server: these tests call runDueCharges with a fixed clock, against the fake Stripe.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { runDueCharges, RETRY_AFTER_MINUTES, MAX_ATTEMPTS } = require('../utils/charges');
const { tripStartsAt } = require('../utils/validateBooking');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const SUMMER = '2030-07-10'; // British Summer Time: 11am is 10:00 UTC
const WINTER = '2030-01-15'; // GMT: 11am is 11:00 UTC
const at = (iso) => new Date(iso);
const PRICES = { adult: 4000, child: 2500, charter: 40000 };
// A booking made online, with a saved card, ready to be charged
const saved = (fields = {}) => t.insertBooking({
    date: SUMMER, timeslot: '11am', adults: 2, children: 0, firstName: 'Ann', lastName: 'Smith', email: 'ann@example.test', phone: '0700',
    paymentStatus: 'card_saved', stripeCustomerId: 'cus_test_ann', stripePaymentMethodId: 'pm_ann', prices: PRICES, ...fields,
});
const after11 = at(`${SUMMER}T10:00:00Z`);

describe('when a trip starts', () => {
    it('is the trip time in Guernsey, summer or winter, including the days the clocks change', () => {
        assert.equal(tripStartsAt(SUMMER, '11am').toISOString(), '2030-07-10T10:00:00.000Z');
        assert.equal(tripStartsAt(SUMMER, '2pm').toISOString(), '2030-07-10T13:00:00.000Z');
        assert.equal(tripStartsAt(WINTER, '11am').toISOString(), '2030-01-15T11:00:00.000Z');
        assert.equal(tripStartsAt('2030-03-31', '11am').toISOString(), '2030-03-31T10:00:00.000Z', 'clocks went forward that morning');
        assert.equal(tripStartsAt('2030-10-27', '11am').toISOString(), '2030-10-27T11:00:00.000Z', 'clocks went back that morning');
    });
});

describe('charging at the trip time', () => {
    it('a booking whose trip has started is charged once, off-session, with a receipt, and marked paid', async () => {
        const id = await saved({ adults: 2, children: 1 });
        assert.deepEqual(await runDueCharges(after11), { paid: 1, failed: 0, retry: 0 });
        const [{ params, options }] = mocks.stripe.charges;
        assert.deepEqual(
            [params.amount, params.currency, params.customer, params.payment_method, params.off_session, params.confirm, params.receipt_email],
            [10500, 'gbp', 'cus_test_ann', 'pm_ann', true, true, 'ann@example.test']
        );
        assert.equal(params.description, 'Sark Boat Trips trip 11am 10-07-2030');
        assert.equal(options.idempotencyKey, `charge_booking_${id}`);
        const b = await t.findBooking(id);
        assert.deepEqual([b.paymentStatus, b.amountPaid, b.stripePaymentIntentId], ['paid', 10500, 'pi_test_1']);
        assert.ok(b.paidAt instanceof Date);
        assert.equal(b.chargeStartedAt, undefined);
    });
    it('nothing is charged a minute before the trip, in summer or winter', async () => {
        await saved({ date: WINTER, stripePaymentMethodId: 'pm_winter' });
        assert.equal((await runDueCharges(at(`${WINTER}T10:59:00Z`))).paid, 0, 'in winter 11am is 11:00 UTC');
        assert.equal((await runDueCharges(at(`${WINTER}T11:00:00Z`))).paid, 1);
        await saved();
        assert.equal((await runDueCharges(at(`${SUMMER}T09:59:00Z`))).paid, 0, 'in summer 11am is 10:00 UTC');
        assert.equal((await runDueCharges(at(`${SUMMER}T10:00:00Z`))).paid, 1);
        assert.equal(mocks.stripe.charges.length, 2);
    });
    it('the 2pm trip is not charged at 11am', async () => {
        await saved({ timeslot: '2pm' });
        assert.equal((await runDueCharges(after11)).paid, 0);
        assert.equal((await runDueCharges(at(`${SUMMER}T13:00:00Z`))).paid, 1);
    });
    it('catches up: a trip that started while the server was off is charged at the next check', async () => {
        await saved({ date: '2030-07-08' });
        assert.equal((await runDueCharges(after11)).paid, 1);
    });
    it('a future trip is left alone', async () => {
        await saved({ date: '2030-07-11' });
        assert.equal((await runDueCharges(after11)).paid, 0);
        assert.equal(mocks.stripe.charges.length, 0);
    });
    it('cancelled bookings are never charged (a weather cancellation costs the customer nothing)', async () => {
        await saved({ status: 'cancelled' });
        assert.equal((await runDueCharges(after11)).paid, 0);
        assert.equal(mocks.stripe.charges.length, 0);
    });
    it('bookings without a saved card, already paid, or paid in person are never charged', async () => {
        await saved({ paymentStatus: 'unpaid' });
        await saved({ paymentStatus: 'paid' });
        await saved({ paymentStatus: 'paid_in_person' });
        await saved({ paymentStatus: undefined });
        await runDueCharges(after11);
        assert.equal(mocks.stripe.charges.length, 0);
    });
    it('marking a booking paid in person before the trip stops the card being charged', async () => {
        const id = await saved();
        await t.call(app, 'post', '/bookings/mark-paid', { token, body: { _id: id } });
        await runDueCharges(after11);
        assert.equal(mocks.stripe.charges.length, 0);
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid_in_person');
    });
    it('the amount is worked out at the trip time: party changes count, infants are free, prices are the saved ones', async () => {
        const edited = await saved({ adults: 3, children: 2, infants: 1 });
        await saved({ adults: 4, charter: 'true', stripePaymentMethodId: 'pm_charter' });
        await saved({ adults: 1, prices: { adult: 3000, child: 2000, charter: 30000 }, stripePaymentMethodId: 'pm_old' });
        await runDueCharges(after11);
        const amounts = Object.fromEntries(mocks.stripe.charges.map(({ params }) => [params.payment_method, params.amount]));
        assert.deepEqual(amounts, { pm_ann: 3 * 4000 + 2 * 2500, pm_charter: 40000, pm_old: 3000 });
        assert.equal((await t.findBooking(edited)).amountPaid, 17000);
    });
    it('a booking worth nothing is marked paid without calling Stripe', async () => {
        await db.collection('admins').updateOne({}, { $set: { adultPrice: 0, childPrice: 0, charterPrice: 0 } });
        const id = await saved({ prices: { adult: 0, child: 0, charter: 0 } });
        assert.equal((await runDueCharges(after11)).paid, 1);
        assert.equal(mocks.stripe.charges.length, 0);
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid');
    });
});

describe('never charging twice', () => {
    it('running the check again charges nothing more', async () => {
        await saved();
        await runDueCharges(after11);
        await runDueCharges(at(`${SUMMER}T10:05:00Z`));
        assert.equal(mocks.stripe.charges.length, 1);
    });
    it('two checks at the same instant (or two copies of the app) still make one charge', async () => {
        await saved();
        await saved({ stripePaymentMethodId: 'pm_two' });
        const results = await Promise.all([runDueCharges(after11), runDueCharges(after11), runDueCharges(after11)]);
        assert.equal(results.reduce((sum, r) => sum + r.paid, 0), 2);
        assert.equal(mocks.stripe.charges.length, 2);
    });
    it('a charge the server started but never finished (it stopped half way) is looked up, not repeated', async () => {
        const id = await saved();
        await runDueCharges(after11); // Stripe charged it...
        // ...but pretend the server stopped before saving the result
        await db.collection('bookings').updateOne({ _id: (await t.findBooking(id))._id }, { $set: { paymentStatus: 'charging', chargeStartedAt: after11 }, $unset: { paidAt: '', amountPaid: '' } });
        mocks.stripe.charges.length = 0;
        await runDueCharges(at(`${SUMMER}T10:${String(RETRY_AFTER_MINUTES).padStart(2, '0')}:00Z`));
        assert.equal(mocks.stripe.charges.length, 0, 'looked up with the payment id it already had, not charged again');
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid');
    });
});

describe('when the charge fails', () => {
    it('a declined card is marked unpaid with the reason, and the owner gets one email listing it; the customer is not chased', async () => {
        mocks.stripe.cards.pm_ann = 'insufficient_funds';
        const id = await saved();
        await saved({ firstName: 'Bob', stripePaymentMethodId: 'pm_bob' });
        mocks.stripe.cards.pm_bob = 'declined';
        assert.deepEqual(await runDueCharges(after11), { paid: 0, failed: 2, retry: 0 });
        const b = await t.findBooking(id);
        assert.equal(b.paymentStatus, 'unpaid');
        assert.equal(b.paymentNote, 'The card was declined: not enough money in the account. Collect the payment on the day.');
        const owner = mocks.sent(t.OWNER);
        assert.equal(owner.length, 1, 'one email for all the failures');
        assert.match(owner[0].subject, /Card payment failed for 2 bookings: collect on the day/);
        assert.match(owner[0].text, /Ann Smith, 11am on 10-07-2030, 2 adults, £80/);
        assert.match(owner[0].text, /Bob Smith/);
        assert.match(owner[0].text, /Open the dashboard: http:\/\/localhost:5173\/dashboard/, 'a link straight to the dashboard');
        assert.equal(mocks.sent('ann@example.test').length, 0);
    });
    it('the bank asking the customer to confirm counts as a failure, with its own reason', async () => {
        mocks.stripe.cards.pm_ann = 'authentication_required';
        const id = await saved();
        await runDueCharges(after11);
        assert.match((await t.findBooking(id)).paymentNote, /bank wanted the customer to confirm/);
    });
    it('a failed booking is not tried again by later checks (no surprise charge days later)', async () => {
        mocks.stripe.cards.pm_ann = 'declined';
        await saved();
        await runDueCharges(after11);
        await runDueCharges(at(`${SUMMER}T12:00:00Z`));
        assert.equal(mocks.stripe.charges.length, 1);
    });
    it('the owner can still mark a failed booking paid in person', async () => {
        mocks.stripe.cards.pm_ann = 'declined';
        const id = await saved();
        await runDueCharges(after11);
        assert.equal((await t.call(app, 'post', '/bookings/mark-paid', { token, body: { _id: id } })).body.ok, true);
        const b = await t.findBooking(id);
        assert.equal(b.paymentStatus, 'paid_in_person');
        assert.equal(b.paymentNote, undefined);
    });
    it('Stripe unreachable: it waits, retries with the same key, and is paid once Stripe is back', async () => {
        mocks.stripe.cards.pm_ann = 'unreachable';
        const id = await saved();
        assert.deepEqual(await runDueCharges(after11), { paid: 0, failed: 0, retry: 1 });
        assert.equal((await t.findBooking(id)).paymentStatus, 'charging');
        await runDueCharges(at(`${SUMMER}T10:05:00Z`));
        assert.equal(mocks.stripe.charges.length, 1, 'not retried before the wait is over');
        mocks.stripe.cards.pm_ann = 'ok';
        await runDueCharges(at(`${SUMMER}T10:${String(RETRY_AFTER_MINUTES).padStart(2, '0')}:00Z`));
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid');
        assert.equal(new Set(mocks.stripe.charges.map((c) => c.options.idempotencyKey)).size, 1, 'always the same key');
        assert.equal(mocks.sent(t.OWNER).length, 0);
    });
    it(`Stripe unreachable ${MAX_ATTEMPTS} times: given up, marked unpaid, and the owner told`, async () => {
        mocks.stripe.cards.pm_ann = 'unreachable';
        const id = await saved();
        for (let i = 0; i < MAX_ATTEMPTS; i++) await runDueCharges(new Date(after11.getTime() + i * RETRY_AFTER_MINUTES * 60000));
        const b = await t.findBooking(id);
        assert.equal(b.paymentStatus, 'unpaid');
        assert.match(b.paymentNote, /could not be reached/);
        assert.equal(mocks.sent(t.OWNER).length, 1);
    });
    it('a cancelled booking stuck as charging is not retried', async () => {
        mocks.stripe.cards.pm_ann = 'unreachable';
        const id = await saved();
        await runDueCharges(after11);
        await db.collection('bookings').updateOne({ _id: (await t.findBooking(id))._id }, { $set: { status: 'cancelled' } });
        mocks.stripe.cards.pm_ann = 'ok';
        await runDueCharges(at(`${SUMMER}T11:00:00Z`));
        assert.equal(mocks.stripe.charges.length, 1);
    });
});
