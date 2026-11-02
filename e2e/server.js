// The server the browser tests talk to: the real app, a throwaway in-memory database, fake email
// and a fake Stripe (the same ones the server tests use), serving a fresh build of the website.
// A few /__test routes let the tests look at what was emailed or saved and switch Stripe on and off.
// They live here, outside the app, so the real app has no test-only doors in it.
const express = require('express');
const t = require('../server/test/helpers');

t.setEnv({ PUBLIC_URL: `http://127.0.0.1:${process.env.E2E_PORT || 4600}` });
const mocks = t.installMocks();
process.env.CLIENT_DIST = process.env.CLIENT_DIST || require('./build-client')();

(async () => {
    const db = await t.startDb();
    const app = require('../server/app');

    const wrapper = express();
    const test = express.Router();
    test.use(express.json());
    test.post('/reset', async (req, res) => { await t.resetDb(); await t.seedSeason(); // the normal season, in case a test changed it
        mocks.reset(); for (const k of Object.keys(mocks.stripe.sessions)) delete mocks.stripe.sessions[k]; res.json({ ok: true }); });
    // sets the season to exact days ('YYYY-MM-DD'), stored as UTC midnight like the real dashboard does
    test.post('/season', async (req, res) => {
        const at = (day) => new Date(`${day}T00:00:00.000Z`);
        await db.collection('admins').deleteMany({});
        await db.collection('admins').insertOne({ seasonStartDate: at(req.body.start), seasonEndDate: at(req.body.end) });
        res.json({ ok: true });
    });
    test.get('/mails', (req, res) => res.json(mocks.mails));
    test.get('/bookings', async (req, res) => res.json(await db.collection('bookings').find({}).toArray()));
    test.post('/stripe-fail', (req, res) => { mocks.stripe.fail = Boolean(req.body.fail); res.json({ ok: true }); });
    test.post('/stripe-session', (req, res) => { mocks.stripe.sessions[req.body.id] = req.body; res.json({ ok: true }); });
    // Plays the customer finishing on Stripe's page: the last checkout started becomes a completed
    // session with a saved card, which the success page (or a webhook) then turns into a booking
    test.post('/complete-checkout', (req, res) => {
        const params = mocks.stripe.created.at(-1);
        const id = `cs_test_created_${mocks.stripe.created.length}`;
        mocks.stripe.sessions[id] = { id, object: 'checkout.session', mode: 'setup', status: 'complete', customer: params.customer, setup_intent: `seti_${id}`, metadata: params.metadata };
        res.json({ id });
    });
    // Plays the buyer paying for a gift voucher on Stripe's page: the last checkout started becomes a
    // paid session, which the thank-you page (or a webhook) then turns into a voucher
    test.post('/complete-voucher-checkout', (req, res) => {
        const params = mocks.stripe.created.at(-1);
        const id = `cs_test_created_${mocks.stripe.created.length}`;
        mocks.stripe.sessions[id] = { id, object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: params.line_items[0].price_data.unit_amount, payment_intent: `pi_${id}`, metadata: params.metadata };
        res.json({ id, params });
    });
    test.get('/vouchers', async (req, res) => res.json(await db.collection('vouchers').find({}).toArray()));
    // A booking put straight into the database, e.g. to fill a trip
    test.post('/insert-booking', async (req, res) => {
        await db.collection('bookings').insertOne({ timeslot: '11am', firstName: 'Test', lastName: 'Booking', adults: 2, children: 0, status: 'active', charter: 'false', ...req.body });
        res.json({ ok: true });
    });
    wrapper.use('/__test', test);
    wrapper.use(app);

    const port = process.env.E2E_PORT || 4600;
    wrapper.listen(port, '127.0.0.1', () => console.log(`e2e server ready on ${port}`));
})().catch((error) => { console.error(error); process.exit(1); });
