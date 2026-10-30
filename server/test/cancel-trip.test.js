// Cancelling a whole trip in one go (a weather day): every booking cancelled, nobody charged,
// everyone told, the trip closed to new bookings, and one summary email for the owner.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { runDueCharges } = require('../utils/charges');
const { tripStartsAt } = require('../utils/validateBooking');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const cancelTrip = (body) => t.call(app, 'post', '/bookings/cancel-trip', { token, body: { date: t.day(10), timeslot: '11am', reason: 'weather', ...body } });
const decode = (html) => html.replace(/&#39;/g, "'");
const card = (fields) => t.insertBooking({ date: t.day(10), timeslot: '11am', paymentStatus: 'card_saved', stripeCustomerId: 'cus_x', stripePaymentMethodId: 'pm_x', ...fields });

describe('cancelling a whole trip', () => {
    it('cancels every booking on that trip, emails each customer with an apology, and nobody is charged', async () => {
        const ann = await card({ firstName: 'Ann', email: 'ann@example.test' });
        const bob = await card({ firstName: 'Bob', email: 'bob@example.test', adults: 3 });
        const res = await cancelTrip({});
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /The 11am trip on .* is cancelled and closed to new bookings: 2 bookings cancelled, 2 customers emailed\. Nobody will be charged\./);
        for (const id of [ann, bob]) assert.equal((await t.findBooking(id)).status, 'cancelled');
        const mail = decode(mocks.sent('ann@example.test')[0].html);
        assert.match(mail, /we've had to cancel this trip because of the weather and sea conditions/);
        assert.match(mail, /Your card has not been charged, and it won't be charged for this booking/);
        assert.doesNotMatch(mail, /If this is a mistake/);
        // and the charge at the trip time leaves them alone
        await runDueCharges(new Date(tripStartsAt(t.day(10), '11am').getTime() + 60000));
        assert.equal(mocks.stripe.charges.length, 0);
    });
    it('closes the trip, so nobody can book it online afterwards (reopen it from the Availability tab)', async () => {
        await cancelTrip({});
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 0);
        const late = await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ date: t.day(10) }) });
        assert.equal(late.body.ok, false);
        await t.call(app, 'post', '/bookings/updateavailability', { token, body: { date: t.day(10), timeslot: '11am', capacity: '12' } });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 12, 'reopened');
    });
    it('only touches that trip: the other trip that day and other days are untouched', async () => {
        const other = await card({ timeslot: '2pm' });
        const tomorrow = await card({ date: t.day(11) });
        await cancelTrip({});
        assert.equal((await t.findBooking(other)).status, 'active');
        assert.equal((await t.findBooking(tomorrow)).status, 'active');
        assert.equal((await t.seatsLeft(app, t.day(10)))['2pm'], 10);
    });
    it('the owner gets one summary, not one email per booking, with a dashboard link', async () => {
        await card({ firstName: 'Ann', lastName: 'Smith', email: 'ann@example.test', phone: '0711' });
        await card({ firstName: 'Bob', email: 'bob@example.test' });
        await cancelTrip({});
        const owner = mocks.sent(t.OWNER);
        assert.equal(owner.length, 1);
        assert.match(owner[0].subject, /^Trip CANCELLED: 11am on .* \(2 bookings\)$/);
        assert.match(owner[0].text, /Ann Smith, 2 adults, phone 0711/);
        assert.match(owner[0].text, /Nobody's saved card will be charged/);
        assert.match(owner[0].text, /Open the dashboard: http:\/\/localhost:5173\/dashboard/);
    });
    it('customers without an email address, or whose email fails, are listed for the owner to contact', async () => {
        await card({ firstName: 'NoMail', email: '' });
        await card({ firstName: 'Bounce', email: 'bounce@example.test' });
        mocks.mailMode = 'client';
        const res = await cancelTrip({});
        assert.match(res.body.data, /0 customers emailed, 2 not emailed \(see your email\)/);
        assert.match(mocks.sent(t.OWNER)[0].text, /NOT EMAILED[\s\S]*NoMail[\s\S]*Bounce/);
    });
    it('anyone who had already paid is flagged for a refund', async () => {
        await t.insertBooking({ date: t.day(10), firstName: 'Paid', email: 'paid@example.test', paymentStatus: 'paid' });
        const res = await cancelTrip({});
        assert.match(res.body.data, /1 had already paid: refund them/);
        assert.match(mocks.sent(t.OWNER)[0].text, /ALREADY PAID, refund them[\s\S]*Paid/);
        assert.match(decode(mocks.sent('paid@example.test')[0].html), /If you've already paid, please get in touch and we'll sort out a refund/);
    });
    it('"other reason" leaves out the weather, and a charter is called a charter', async () => {
        await card({ email: 'group@example.test', charter: 'true' });
        await cancelTrip({ reason: 'other' });
        const mail = decode(mocks.sent('group@example.test')[0].html);
        assert.match(mail, /we've had to cancel this charter\. We'd love to take you out another day/);
        assert.doesNotMatch(mail, /weather/);
    });
    it('bookings already cancelled are not cancelled or emailed again', async () => {
        await card({ email: 'old@example.test', status: 'cancelled' });
        const res = await cancelTrip({});
        assert.match(res.body.data, /0 bookings cancelled/);
        assert.equal(mocks.sent('old@example.test').length, 0);
    });
    it('a trip with no bookings is simply closed', async () => {
        const res = await cancelTrip({ timeslot: '2pm' });
        assert.equal(res.body.ok, true);
        assert.equal((await t.seatsLeft(app, t.day(10)))['2pm'], 0);
    });
    it('needs a real date, trip and reason, and the owner\'s login', async () => {
        for (const bad of [{ date: '15-06-2033' }, { timeslot: '3pm' }, { reason: 'bored' }, { reason: ['weather'] }]) {
            assert.equal((await cancelTrip(bad)).status, 400, JSON.stringify(bad));
        }
        assert.equal((await t.call(app, 'post', '/bookings/cancel-trip', { body: { date: t.day(10), timeslot: '11am' } })).status, 401);
        assert.equal(await db.collection('availabilities').countDocuments({}), 0, 'nothing was closed by a refused request');
    });
});
