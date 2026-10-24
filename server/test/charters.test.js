// Private charters paid through Stripe (Stripe itself is faked; webhook signatures are really checked).
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let db;
before(async () => { db = await t.startDb(); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); mocks.reset(); for (const k of Object.keys(mocks.stripe.sessions)) delete mocks.stripe.sessions[k]; });

const checkout = (override = {}) => t.call(app, 'post', '/charters/create-checkout-session', { body: { ...t.booking({ date: t.day(15), adults: '4' }), charter: 'true', ...override } });
const verify = (id) => t.call(app, 'get', `/charters/verify-payment${id === undefined ? '' : `?session_id=${id}`}`);
const bookingsFor = (id) => db.collection('bookings').find({ stripeSessionId: id }).toArray();

describe('starting a charter checkout', () => {
    it('creates a Stripe session that charges the PRICE_ID price and returns the customer to PUBLIC_URL', async () => {
        const res = await checkout();
        assert.equal(res.status, 200);
        assert.match(res.body.url, /^https:\/\/checkout\.stripe\.test\//);
        const [params] = mocks.stripe.created;
        assert.equal(params.mode, 'payment');
        assert.equal(params.line_items[0].price, 'price_test_FAKE');
        assert.equal(params.success_url, 'http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}');
        assert.equal(params.cancel_url, 'http://localhost:5173/canceled');
        assert.equal(params.metadata.charter, 'true');
        assert.equal(params.metadata.date, t.day(15));
        assert.doesNotMatch(JSON.stringify(params), /herokuapp/);
    });
    it('uses the TEST key when not in production, even though the live key is also set', async () => {
        assert.ok(mocks.stripe.keys.includes('sk_test_FAKE'));
        assert.ok(!mocks.stripe.keys.includes('sk_live_FAKE'));
    });
    it('cuts a long message down to the 500 characters Stripe allows, and keeps the other details', async () => {
        await checkout({ message: 'x'.repeat(900) });
        const { metadata } = mocks.stripe.created[0];
        assert.equal(metadata.message.length, 500);
        assert.equal(metadata.firstName, 'Alice');
    });
    it('applies the same rules as an ordinary booking, and never reaches Stripe when it refuses', async () => {
        const refused = [{ email: 'nope' }, { adults: '13' }, { date: t.day(-1) }, { date: t.day(250) }, { phone: '' }, { timeslot: '3pm' }];
        for (const override of refused) {
            const res = await checkout(override);
            assert.equal(res.status, 400, JSON.stringify(override));
        }
        assert.equal(mocks.stripe.created.length, 0);
    });
    it('a bot that fills in the hidden field is turned away without calling Stripe', async () => {
        const res = await checkout({ website_url: 'http://spam.example' });
        assert.equal(res.body.ok, false);
        assert.equal(mocks.stripe.created.length, 0);
    });
    it('needs the whole trip to itself: any booking on it refuses the charter, a cancelled one does not', async () => {
        await t.insertBooking({ date: t.day(15), adults: 1 });
        const refused = await checkout();
        assert.equal(refused.body.ok, false);
        assert.match(refused.body.data, /No spaces available/);
        await db.collection('bookings').updateMany({}, { $set: { status: 'cancelled' } });
        assert.ok((await checkout()).body.url);
    });
    it('the other trip that day is still available, but a second charter on the same trip is not', async () => {
        await t.insertBooking({ date: t.day(15), timeslot: '11am', adults: 2, charter: 'true' });
        assert.equal((await checkout({ timeslot: '11am' })).body.ok, false);
        assert.ok((await checkout({ timeslot: '2pm' })).body.url);
    });
    it('a trip you have limited to fewer seats can still be chartered, but a closed one cannot', async () => {
        await db.collection('availabilities').insertOne({ date: t.day(15), timeslot: '11am', capacity: 8 });
        assert.ok((await checkout()).body.url);
        await db.collection('availabilities').updateOne({ date: t.day(15) }, { $set: { capacity: 0 } });
        assert.equal((await checkout()).body.ok, false);
    });
    it('when Stripe is down the customer gets a clear message, the server carries on, and nothing is saved', async () => {
        mocks.stripe.fail = true;
        const res = await checkout();
        assert.equal(res.status, 502);
        assert.match(res.body.data, /couldn't start the payment\. You have not been charged/);
        assert.equal(await db.collection('bookings').countDocuments({}), 0);
        mocks.stripe.fail = false;
        assert.ok((await checkout()).body.url, 'and it works again afterwards');
    });
});

describe('Stripe says a charter was paid (the webhook)', () => {
    it('a forged or wrongly signed message is rejected and creates nothing', async () => {
        const session = t.paidSession('cs_test_forged');
        assert.equal((await t.webhook(app, session, { signature: 't=1,v1=deadbeef' })).status, 400);
        assert.equal((await t.webhook(app, session, { secret: 'whsec_somebody_else' })).status, 400);
        assert.equal((await bookingsFor('cs_test_forged')).length, 0);
    });
    it('a genuine one creates the booking with its Stripe id, and emails the customer and the owner', async () => {
        const session = t.paidSession('cs_test_paid');
        assert.equal((await t.webhook(app, session)).status, 200);
        const [b] = await bookingsFor('cs_test_paid');
        assert.deepEqual([b.charter, b.status, b.adults, b.firstName, b.lastName], ['true', 'active', 2, 'Carol', 'Charter']);
        assert.ok(mocks.sent(session.metadata.email).some((m) => m.subject === 'PRIVATE CHARTER Confirmation Sark Boat Trips'));
        assert.ok(mocks.sent(t.OWNER).some((m) => m.subject === `New CHARTER on : ${session.metadata.date}`));
        assert.equal(mocks.sent().length, 2);
    });
    it('it blocks the trip simply by existing, without writing a capacity setting', async () => {
        const session = t.paidSession('cs_test_blocks', { date: t.day(14) });
        await t.webhook(app, session);
        assert.deepEqual(await t.seatsLeft(app, t.day(14)), { '11am': 0, '2pm': 12 });
        assert.equal(await db.collection('availabilities').countDocuments({}), 0);
    });
    it('Stripe sending the same message again (a retry) changes nothing and emails nobody twice', async () => {
        const session = t.paidSession('cs_test_retry');
        await t.webhook(app, session);
        mocks.mails.length = 0;
        assert.equal((await t.webhook(app, session)).status, 200);
        assert.equal((await bookingsFor('cs_test_retry')).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('eight copies arriving at the same instant still make exactly one booking and one pair of emails', async () => {
        const session = t.paidSession('cs_test_burst');
        mocks.stripe.sessions[session.id] = session;
        const results = await Promise.all([...Array(5)].map(() => t.webhook(app, session)).concat([...Array(3)].map(() => verify(session.id))));
        assert.ok(results.every((r) => r.status === 200));
        assert.equal((await bookingsFor('cs_test_burst')).length, 1);
        assert.equal(mocks.sent().length, 2);
    });
    it('an unpaid session, a paid session that is not a charter, and unrelated events all make no booking', async () => {
        await t.webhook(app, { ...t.paidSession('cs_test_unpaid'), payment_status: 'unpaid' });
        await t.webhook(app, t.paidSession('cs_test_plain', { charter: 'false' }));
        assert.equal((await t.webhook(app, t.paidSession('cs_test_other'), { type: 'payment_intent.succeeded' })).status, 200);
        assert.equal(await db.collection('bookings').countDocuments({}), 0);
    });
    it('if someone else took the trip while the customer was paying: the charter is still saved, the customer is confirmed, and the owner gets an ACTION NEEDED alert', async () => {
        await t.insertBooking({ date: t.day(12), adults: 1 });
        mocks.reset();
        const session = t.paidSession('cs_test_clash');
        await t.webhook(app, session);
        assert.equal((await bookingsFor('cs_test_clash')).length, 1);
        assert.ok(mocks.sent(session.metadata.email).length === 1);
        const alert = mocks.sent(t.OWNER);
        assert.equal(alert.length, 1);
        assert.match(alert[0].subject, /^ACTION NEEDED/);
        assert.ok(!alert.some((m) => /New CHARTER/.test(m.subject)));
    });
    it('the owner emails link to the dashboard on PUBLIC_URL', async () => {
        await t.webhook(app, t.paidSession('cs_test_link'));
        const ownerMail = mocks.sent(t.OWNER)[0];
        assert.ok(ownerMail.html.includes('href="http://localhost:5173/dashboard"'));
    });
    it('without a signing secret configured the webhook says so (503) instead of trusting anyone', async () => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        try { assert.equal((await t.webhook(app, t.paidSession('cs_test_nosecret'))).status, 503); }
        finally { process.env.STRIPE_WEBHOOK_SECRET = secret; }
    });
});

describe('the success page asks about a payment', () => {
    it('a missing or malformed session id is a 400, an unknown one a 404', async () => {
        assert.equal((await verify()).status, 400);
        assert.equal((await verify('not-a-session')).status, 400);
        assert.equal((await verify('cs_test_doesnotexist')).status, 404);
    });
    it('an unpaid session says "not completed" and makes no booking', async () => {
        mocks.stripe.sessions.cs_test_u = { ...t.paidSession('cs_test_u'), payment_status: 'unpaid' };
        const res = await verify('cs_test_u');
        assert.equal(res.body.ok, false);
        assert.match(res.body.message, /not completed/i);
        assert.equal((await bookingsFor('cs_test_u')).length, 0);
    });
    it('a session that is not a charter is treated as not found', async () => {
        mocks.stripe.sessions.cs_test_np = t.paidSession('cs_test_np', { charter: 'false' });
        assert.equal((await verify('cs_test_np')).status, 404);
    });
    it('a paid session creates the booking even if the webhook has not arrived (and it works with no webhook configured)', async () => {
        const session = mocks.stripe.sessions.cs_test_first = t.paidSession('cs_test_first');
        const res = await verify('cs_test_first');
        assert.equal(res.body.ok, true);
        assert.deepEqual([res.body.name, res.body.date], ['Carol', session.metadata.date]);
        assert.equal((await bookingsFor('cs_test_first')).length, 1);
        mocks.mails.length = 0;
        assert.equal((await t.webhook(app, session)).status, 200, 'the webhook arriving later is harmless');
        assert.equal((await bookingsFor('cs_test_first')).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('refreshing the page shows the same confirmation again, with no second booking or email (it used to show a failure)', async () => {
        mocks.stripe.sessions.cs_test_refresh = t.paidSession('cs_test_refresh');
        await verify('cs_test_refresh');
        mocks.mails.length = 0;
        const again = await verify('cs_test_refresh');
        assert.equal(again.body.ok, true);
        assert.equal((await bookingsFor('cs_test_refresh')).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('after the webhook has already made the booking, the page still confirms it', async () => {
        const session = mocks.stripe.sessions.cs_test_after = t.paidSession('cs_test_after');
        await t.webhook(app, session);
        assert.equal((await verify('cs_test_after')).body.ok, true);
    });
});
