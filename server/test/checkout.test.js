// Online booking through Stripe's card page, for trips and charters (paymentsspec.md). Stripe itself
// is faked; webhook signatures are really checked. Nothing is ever charged here: the card is saved,
// and the booking is made once Stripe says so.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let db;
before(async () => { db = await t.startDb(); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const charterCheckout = (override = {}) => t.call(app, 'post', '/charters/create-checkout-session', { body: { ...t.booking({ date: t.day(15), adults: '4' }), ...override } });
const tripCheckout = (override = {}) => t.call(app, 'post', '/bookings/checkout', { body: { ...t.booking({ date: t.day(15), adults: '4' }), ...override } });
const verify = (id) => t.call(app, 'get', `/charters/verify-payment${id === undefined ? '' : `?session_id=${id}`}`);
const bookingsFor = (id) => db.collection('bookings').find({ stripeSessionId: id }).toArray();

describe('starting a checkout', () => {
    it('a trip opens Stripe in "save a card" mode, in pounds, for a new Stripe customer, and returns to PUBLIC_URL', async () => {
        const res = await tripCheckout();
        assert.equal(res.status, 200);
        assert.match(res.body.url, /^https:\/\/checkout\.stripe\.test\//);
        const [params] = mocks.stripe.created;
        assert.equal(params.mode, 'setup', 'nothing is charged at booking');
        assert.equal(params.currency, 'gbp');
        assert.equal(params.customer, 'cus_test_1');
        assert.deepEqual(mocks.stripe.customers[0], { email: params.metadata.email, name: 'Alice Smith', phone: '07123 456789' });
        assert.equal(params.success_url, 'http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}');
        assert.equal(params.cancel_url, 'http://localhost:5173/canceled?kind=trip');
        assert.equal(params.metadata.kind, 'trip');
        assert.equal(params.metadata.date, t.day(15));
        assert.equal(params.line_items, undefined, 'no deposit and no price object any more');
        assert.equal(params.consent_collection, undefined, 'no terms tick box unless STRIPE_TERMS_CONSENT is set');
        assert.doesNotMatch(JSON.stringify(params), /herokuapp|price_/);
    });
    it('Stripe\'s page tells the customer what will be charged, when, and that weather cancellations are free', async () => {
        await tripCheckout({ adults: '4', children: '1' });
        await charterCheckout({ date: t.day(16) });
        const [trip, charter] = mocks.stripe.created.map((p) => p.custom_text.submit.message);
        assert.equal(trip, `Your card won't be charged now. £185 will be charged at 11am on ${t.long(t.day(15))}, when your trip starts. You can cancel free of charge up to 24 hours before your trip starts. If we cancel because of the weather, you won't be charged.`);
        assert.match(charter, /£400 will be charged at 11am .* when your charter starts\. You can cancel free of charge up to 48 hours before your charter starts\./);
    });
    it('closing Stripe\'s page returns a charter customer to a page that sends them back to the charters page', async () => {
        await charterCheckout();
        assert.equal(mocks.stripe.created[0].cancel_url, 'http://localhost:5173/canceled?kind=charter');
    });
    it('the kind of booking is set by the address used, never by the customer', async () => {
        await tripCheckout({ charter: 'true', kind: 'charter' });
        assert.equal(mocks.stripe.created[0].metadata.kind, 'trip');
        assert.equal(mocks.stripe.created[0].metadata.charter, undefined);
    });
    it('uses the TEST key when not in production, even though the live key is also set', async () => {
        assert.ok(mocks.stripe.keys.includes('sk_test_FAKE'));
        assert.ok(!mocks.stripe.keys.includes('sk_live_FAKE'));
    });
    it('keeps a long message whole by splitting it across two fields (Stripe allows 500 characters each)', async () => {
        const message = `${'a'.repeat(500)}${'b'.repeat(400)}`;
        const { booking } = await t.bookOnline(app, t.booking({ message }));
        const { metadata } = mocks.stripe.created[0];
        assert.equal(metadata.message.length, 500);
        assert.equal(metadata.message2.length, 400);
        assert.equal(booking.message, message);
    });
    it('the boat takes 12 people in all: a bigger party is refused, for a charter too (it has no seat count to stop it)', async () => {
        for (const party of [{ adults: '12', children: '12', infants: '12' }, { adults: '6', children: '6', infants: '1' }]) {
            for (const checkout of [charterCheckout, tripCheckout]) {
                const res = await checkout(party);
                assert.equal(res.status, 400, JSON.stringify(party));
                assert.equal(res.body.data, 'The boat takes up to 12 people, infants included. For a bigger group, please contact us.');
            }
        }
        assert.equal(mocks.stripe.created.length, 0);
        assert.ok((await charterCheckout({ adults: '6', children: '4', infants: '2' })).body.url, 'a charter of exactly 12 is fine');
    });
    it('applies the booking rules, and never reaches Stripe when it refuses', async () => {
        const refused = [{ email: 'nope' }, { adults: '13' }, { date: t.day(-1) }, { date: t.day(250) }, { phone: '' }, { timeslot: '3pm' }];
        for (const override of refused) {
            assert.equal((await charterCheckout(override)).status, 400, JSON.stringify(override));
            assert.equal((await tripCheckout(override)).status, 400, JSON.stringify(override));
        }
        assert.equal(mocks.stripe.created.length, 0);
        assert.equal(mocks.stripe.customers.length, 0);
    });
    it('a bot that fills in the hidden field is turned away without calling Stripe', async () => {
        assert.equal((await charterCheckout({ website_url: 'http://spam.example' })).body.ok, false);
        assert.equal((await tripCheckout({ website_url: 'http://spam.example' })).body.ok, false);
        assert.equal(mocks.stripe.created.length, 0);
    });
    it('a charter needs the whole trip to itself: any booking on it refuses the charter, a cancelled one does not', async () => {
        await t.insertBooking({ date: t.day(15), adults: 1 });
        const refused = await charterCheckout();
        assert.equal(refused.body.ok, false);
        assert.match(refused.body.data, /already has bookings, and a private charter needs the whole boat/);
        await db.collection('bookings').updateMany({}, { $set: { status: 'cancelled' } });
        assert.ok((await charterCheckout()).body.url);
    });
    it('the other trip that day is still available, but a second charter on the same trip is not', async () => {
        await t.insertBooking({ date: t.day(15), timeslot: '11am', adults: 2, charter: 'true' });
        assert.equal((await charterCheckout({ timeslot: '11am' })).body.ok, false);
        assert.equal((await tripCheckout({ timeslot: '11am' })).body.ok, false);
        assert.ok((await charterCheckout({ timeslot: '2pm' })).body.url);
    });
    it('a trip you have limited to fewer seats can still be chartered, but a closed one cannot', async () => {
        await db.collection('availabilities').insertOne({ date: t.day(15), timeslot: '11am', capacity: 8 });
        assert.ok((await charterCheckout()).body.url);
        await db.collection('availabilities').updateOne({ date: t.day(15) }, { $set: { capacity: 0 } });
        assert.equal((await charterCheckout()).body.ok, false);
    });
    it('when Stripe is down the customer gets a clear message, the server carries on, and nothing is saved', async () => {
        mocks.stripe.fail = true;
        const res = await tripCheckout();
        assert.equal(res.status, 502);
        assert.match(res.body.data, /couldn't open the card page\. Nothing has been booked or charged/);
        assert.equal(await db.collection('bookings').countDocuments({}), 0);
        mocks.stripe.fail = false;
        assert.ok((await tripCheckout()).body.url, 'and it works again afterwards');
    });
});

describe('Stripe says a card was saved (the webhook)', () => {
    it('a forged or wrongly signed message is rejected and creates nothing', async () => {
        const session = t.cardSession('cs_test_forged');
        assert.equal((await t.webhook(app, session, { signature: 't=1,v1=deadbeef' })).status, 400);
        assert.equal((await t.webhook(app, session, { secret: 'whsec_somebody_else' })).status, 400);
        assert.equal((await bookingsFor('cs_test_forged')).length, 0);
    });
    it('a charter is created with the saved card, ready to be charged, and the customer and owner are emailed', async () => {
        const session = t.cardSession('cs_test_saved');
        assert.equal((await t.webhook(app, session)).status, 200);
        const [b] = await bookingsFor('cs_test_saved');
        assert.deepEqual([b.charter, b.status, b.adults, b.firstName, b.lastName], ['true', 'active', 2, 'Carol', 'Charter']);
        assert.deepEqual([b.paymentStatus, b.stripeCustomerId, b.stripePaymentMethodId], ['card_saved', 'cus_test_saved', 'pm_for_seti_cs_test_saved']);
        assert.deepEqual(b.prices, { adult: 4000, child: 2500, charter: 40000 }, 'the prices in force are saved on it');
        const confirmation = mocks.sent(session.metadata.email).find((m) => m.subject === `Your private charter on ${t.short(session.metadata.date)} at 11am is confirmed`);
        assert.match(confirmation.text, /Payment: £400, charged to your saved card at 11am on the day\n/);
        assert.match(confirmation.text, /You can cancel free of charge up to 48 hours before your charter starts\./);
        assert.doesNotMatch(confirmation.text, /deposit/i);
        assert.ok(mocks.sent(t.OWNER).some((m) => /^New charter: Carol Charter, 2 people, 11am /.test(m.subject)));
        assert.equal(mocks.sent().length, 2);
    });
    it('a trip is created the same way, with the trip emails', async () => {
        const session = t.cardSession('cs_test_trip', { kind: 'trip', adults: '3' });
        await t.webhook(app, session);
        const [b] = await bookingsFor('cs_test_trip');
        assert.deepEqual([b.charter, b.paymentStatus, b.adults], ['false', 'card_saved', 3]);
        assert.ok(mocks.sent(session.metadata.email).some((m) => m.subject === `Your boat trip on ${t.short(session.metadata.date)} at 11am is confirmed`));
        assert.ok(mocks.sent(t.OWNER).some((m) => /^New booking: .*, 3 people, 11am /.test(m.subject)));
    });
    it('a charter blocks the trip simply by existing, without writing a capacity setting', async () => {
        await t.webhook(app, t.cardSession('cs_test_blocks', { date: t.day(14) }));
        assert.deepEqual(await t.seatsLeft(app, t.day(14)), { '11am': 0, '2pm': 12 });
        assert.equal(await db.collection('availabilities').countDocuments({}), 0);
    });
    it('Stripe sending the same message again (a retry) changes nothing and emails nobody twice', async () => {
        const session = t.cardSession('cs_test_retry');
        await t.webhook(app, session);
        mocks.mails.length = 0;
        assert.equal((await t.webhook(app, session)).status, 200);
        assert.equal((await bookingsFor('cs_test_retry')).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('eight copies arriving at the same instant still make exactly one booking and one pair of emails', async () => {
        const session = t.cardSession('cs_test_burst');
        mocks.stripe.sessions[session.id] = session;
        const results = await Promise.all([...Array(5)].map(() => t.webhook(app, session)).concat([...Array(3)].map(() => verify(session.id))));
        assert.ok(results.every((r) => r.status === 200));
        assert.equal((await bookingsFor('cs_test_burst')).length, 1);
        assert.equal(mocks.sent().length, 2);
    });
    it('an unfinished checkout, a session that is not ours, an old deposit payment and unrelated events make no booking', async () => {
        await t.webhook(app, { ...t.cardSession('cs_test_open'), status: 'open' });
        await t.webhook(app, { ...t.cardSession('cs_test_foreign'), metadata: { firstName: 'Someone' } });
        await t.webhook(app, { ...t.cardSession('cs_test_deposit'), mode: 'payment', payment_status: 'paid' });
        assert.equal((await t.webhook(app, t.cardSession('cs_test_other'), { type: 'payment_intent.succeeded' })).status, 200);
        assert.equal(await db.collection('bookings').countDocuments({}), 0);
    });
    it('the owner emails link to the dashboard on PUBLIC_URL', async () => {
        await t.webhook(app, t.cardSession('cs_test_link'));
        assert.ok(mocks.sent(t.OWNER)[0].html.includes('href="http://localhost:5173/dashboard"'));
    });
    it('without a signing secret configured the webhook says so (503) instead of trusting anyone', async () => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        try { assert.equal((await t.webhook(app, t.cardSession('cs_test_nosecret'))).status, 503); }
        finally { process.env.STRIPE_WEBHOOK_SECRET = secret; }
    });
});

describe('the trip fills up while the customer is entering their card', () => {
    it('a trip is never overbooked: the booking is kept as cancelled with the reason, nothing charged, and both sides are told', async () => {
        const res = await tripCheckout({ adults: '4' });
        assert.ok(res.body.url);
        await t.insertBooking({ date: t.day(15), adults: 10 }); // someone else took most of the seats meanwhile
        const params = mocks.stripe.created[0];
        const session = { ...t.cardSession('cs_test_full'), metadata: params.metadata, customer: params.customer };
        await t.webhook(app, session);
        const [b] = await bookingsFor('cs_test_full');
        assert.equal(b.status, 'cancelled');
        assert.equal(b.paymentStatus, 'card_saved', 'the card is kept, so the booking can be restored if room frees up');
        assert.match(b.paymentNote, /filled up .* Nothing was charged/);
        assert.equal((await t.seatsLeft(app, t.day(15)))['11am'], 2, 'the seats were not taken');
        const toCustomer = mocks.sent(params.metadata.email);
        assert.equal(toCustomer.length, 1);
        assert.match(toCustomer[0].subject, /^Sorry, the boat trip on .* is full$/);
        assert.match(toCustomer[0].html, /Nothing has been charged/);
        assert.match(mocks.sent(t.OWNER)[0].subject, /Booking NOT made/);
    });
    it('the same for a charter when someone books its trip first', async () => {
        await t.insertBooking({ date: t.day(12), adults: 1 });
        await t.webhook(app, t.cardSession('cs_test_clash'));
        const [b] = await bookingsFor('cs_test_clash');
        assert.equal(b.status, 'cancelled');
        assert.equal((await t.seatsLeft(app, t.day(12)))['11am'], 11);
    });
    it('a card saved after the trip has left makes no booking to charge: kept as cancelled, and both sides are told why', async () => {
        // Stripe's page stays open for a day; the one hour cutoff was only checked when they started
        const session = t.cardSession('cs_test_left', { kind: 'trip', date: t.day(-1) }); // yesterday's 11am
        await t.webhook(app, session);
        const [b] = await bookingsFor('cs_test_left');
        assert.equal(b.status, 'cancelled');
        assert.match(b.paymentNote, /had already left .* Nothing was charged/);
        const { runDueCharges } = require('../utils/charges');
        assert.deepEqual(await runDueCharges(), { paid: 0, failed: 0, retry: 0 });
        assert.equal(mocks.stripe.charges.length, 0, 'nothing is charged for a trip they were not on');
        const [toCustomer] = mocks.sent(session.metadata.email);
        assert.match(toCustomer.subject, /^Sorry, the boat trip on .* had already left$/);
        assert.match(toCustomer.html, /had already left, so we couldn&#39;t book you/);
        assert.match(toCustomer.html, /Nothing has been charged/);
        assert.match(mocks.sent(t.OWNER)[0].subject, /^Booking NOT made \(trip had left\)/);
        mocks.stripe.sessions.cs_test_left = session;
        const page = await verify('cs_test_left');
        assert.equal(page.body.ok, false);
        assert.match(page.body.message, /had already left/);
    });
    it('the success page says it was not booked', async () => {
        await t.insertBooking({ date: t.day(12), adults: 1 });
        mocks.stripe.sessions.cs_test_fullpage = t.cardSession('cs_test_fullpage');
        const res = await verify('cs_test_fullpage');
        assert.equal(res.body.ok, false);
        assert.match(res.body.message, /filled up/);
    });
});

describe('the success page asks about a checkout', () => {
    it('a missing or malformed session id is a 400, an unknown one a 404', async () => {
        assert.equal((await verify()).status, 400);
        assert.equal((await verify('not-a-session')).status, 400);
        assert.equal((await verify('cs_test_doesnotexist')).status, 404);
    });
    it('a checkout where the card was not saved says so and makes no booking', async () => {
        mocks.stripe.sessions.cs_test_u = { ...t.cardSession('cs_test_u'), status: 'open' };
        const res = await verify('cs_test_u');
        assert.equal(res.body.ok, false);
        assert.match(res.body.message, /card was not saved/i);
        assert.equal((await bookingsFor('cs_test_u')).length, 0);
    });
    it('a session that is not ours is treated as not found', async () => {
        mocks.stripe.sessions.cs_test_np = { ...t.cardSession('cs_test_np'), metadata: { firstName: 'X' } };
        assert.equal((await verify('cs_test_np')).status, 404);
    });
    it('a saved card creates the booking even if the webhook has not arrived, and says what will be charged', async () => {
        const session = mocks.stripe.sessions.cs_test_first = t.cardSession('cs_test_first');
        const res = await verify('cs_test_first');
        assert.equal(res.body.ok, true);
        assert.deepEqual([res.body.name, res.body.date, res.body.timeslot, res.body.charter, res.body.amount, res.body.cardLabel], ['Carol', session.metadata.date, '11am', true, 40000, 'Visa •••• 4242 (expires 08/30)']);
        assert.equal((await bookingsFor('cs_test_first')).length, 1);
        mocks.mails.length = 0;
        assert.equal((await t.webhook(app, session)).status, 200, 'the webhook arriving later is harmless');
        assert.equal((await bookingsFor('cs_test_first')).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('a trip says it is not a charter, and its amount', async () => {
        mocks.stripe.sessions.cs_test_tp = t.cardSession('cs_test_tp', { kind: 'trip', adults: '2', children: '1' });
        const res = await verify('cs_test_tp');
        assert.deepEqual([res.body.ok, res.body.charter, res.body.amount], [true, false, 10500]);
    });
    it('refreshing the page shows the same confirmation again, with no second booking or email', async () => {
        mocks.stripe.sessions.cs_test_refresh = t.cardSession('cs_test_refresh');
        await verify('cs_test_refresh');
        mocks.mails.length = 0;
        const again = await verify('cs_test_refresh');
        assert.equal(again.body.ok, true);
        assert.equal((await bookingsFor('cs_test_refresh')).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('after the webhook has already made the booking, the page still confirms it', async () => {
        const session = mocks.stripe.sessions.cs_test_after = t.cardSession('cs_test_after');
        await t.webhook(app, session);
        assert.equal((await verify('cs_test_after')).body.ok, true);
    });
});
