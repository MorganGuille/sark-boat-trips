// A laptop that only has the LIVE Stripe key: charter payments must switch themselves off, never use it.
const t = require('./helpers');
t.setEnv({ STRIPETESTKEY: undefined }); // NODE_ENV is not production and there is no test key
const mocks = t.installMocks();
const app = require('../app');
const { settings } = require('../utils/settings');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

let db;
before(async () => { db = await t.startDb(); });
after(() => t.stopDb());

describe('charter payments with only a live key, outside production', () => {
    it('are switched off, and the reason names the problem', () => {
        assert.match(settings.stripe.problem, /only a LIVE Stripe key is available but this is not production/);
        assert.equal(settings.stripe.key, null);
    });
    it('the live key is never given to Stripe', () => {
        assert.ok(!mocks.stripe.keys.includes('sk_live_FAKE'));
    });
    it('starting a checkout is refused politely (503) and Stripe is never called', async () => {
        const res = await t.call(app, 'post', '/charters/create-checkout-session', { body: { ...t.booking({ date: t.day(15) }), charter: 'true' } });
        assert.equal(res.status, 503);
        assert.match(res.body.data, /aren't available right now\. Please contact us/);
        assert.equal(mocks.stripe.created.length, 0);
    });
    it('checking a payment is refused the same way', async () => {
        assert.equal((await t.call(app, 'get', '/charters/verify-payment?session_id=cs_test_x')).status, 503);
    });
    it('Stripe\'s webhook still works, because it only needs the signing secret', async () => {
        assert.equal((await t.webhook(app, t.paidSession('cs_test_off'))).status, 200);
        assert.equal(await db.collection('bookings').countDocuments({ stripeSessionId: 'cs_test_off' }), 1);
    });
    it('the rest of the site is unaffected', async () => {
        assert.equal((await t.call(app, 'get', '/admin/getSeasonDates')).status, 200);
        assert.equal((await t.call(app, 'post', '/bookings/add', { body: t.booking() })).body.ok, true);
    });
});
