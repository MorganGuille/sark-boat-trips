// A laptop that only has the LIVE Stripe key: online booking must switch itself off, never use it.
const t = require('./helpers');
t.setEnv({ STRIPETESTKEY: undefined }); // NODE_ENV is not production and there is no test key
const mocks = t.installMocks();
const app = require('../app');
const { settings } = require('../utils/settings');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

let token;
before(async () => { await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());

describe('online booking with only a live key, outside production', () => {
    it('is switched off, and the reason names the problem', () => {
        assert.match(settings.stripe.problem, /only a LIVE Stripe key is available but this is not production/);
        assert.equal(settings.stripe.key, null);
    });
    it('the live key is never given to Stripe', () => {
        assert.ok(!mocks.stripe.keys.includes('sk_live_FAKE'));
    });
    it('starting a trip or charter checkout is refused politely (503) and Stripe is never called', async () => {
        for (const path of ['/bookings/checkout', '/charters/create-checkout-session']) {
            const res = await t.call(app, 'post', path, { body: t.booking({ date: t.day(15) }) });
            assert.equal(res.status, 503, path);
            assert.match(res.body.data, /Online booking isn't available right now\. Please call or email us/);
        }
        assert.equal(mocks.stripe.created.length, 0);
        assert.equal(mocks.stripe.customers.length, 0);
    });
    it('checking a booking is refused the same way', async () => {
        assert.equal((await t.call(app, 'get', '/charters/verify-payment?session_id=cs_test_x')).status, 503);
    });
    it('Stripe\'s webhook still checks signatures (that needs only the signing secret)', async () => {
        assert.equal((await t.webhook(app, t.cardSession('cs_test_off'), { signature: 't=1,v1=forged' })).status, 400);
    });
    it('the rest of the site is unaffected: the season loads and the owner can still add bookings', async () => {
        assert.equal((await t.call(app, 'get', '/admin/getSeasonDates')).status, 200);
        assert.equal((await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(10), timeslot: '11am', adults: '2' } })).body.ok, true);
    });
});
