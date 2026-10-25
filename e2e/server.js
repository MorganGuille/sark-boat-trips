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
    wrapper.use('/__test', test);
    wrapper.use(app);

    const port = process.env.E2E_PORT || 4600;
    wrapper.listen(port, '127.0.0.1', () => console.log(`e2e server ready on ${port}`));
})().catch((error) => { console.error(error); process.exit(1); });
