// Security headers and CORS in production.
const t = require('./helpers');
t.setEnv({ NODE_ENV: 'production', PUBLIC_URL: 'https://www.example.test' });
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

before(() => t.startDb());
after(() => t.stopDb());

const https = { 'X-Forwarded-Proto': 'https' };
const get = (origin, path = '/admin/getSeasonDates') => t.call(app, 'get', path, { headers: { ...https, ...(origin ? { Origin: origin } : {}) } });
const acao = (res) => res.headers['access-control-allow-origin'];

describe('production', () => {
    it('upgrades http to https through the policy', async () => {
        assert.ok((await get()).headers['content-security-policy'].includes('upgrade-insecure-requests'));
    });
    it('sends visitors who arrive over plain http to https', async () => {
        const res = await t.call(app, 'get', '/bookings');
        assert.equal(res.status, 301);
        assert.match(res.headers.location, /^https:\/\//);
        assert.equal((await get()).status, 200, 'and requests that already came over https are fine');
    });
    it('sends no CORS headers at all: not to the site itself, a stranger, or a page on a laptop', async () => {
        for (const origin of ['https://www.example.test', 'https://evil.example', 'http://127.0.0.1:5173', 'http://localhost:5173']) {
            assert.equal(acao(await get(origin)), undefined, origin);
        }
    });
    it('a stranger\'s permission check gets nothing', async () => {
        const res = await t.call(app, 'options', '/bookings/cancel', { headers: { ...https, Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
        assert.equal(acao(res), undefined);
        assert.equal(res.headers['access-control-allow-methods'], undefined);
    });
    it('the site itself still works normally', async () => {
        assert.equal((await get()).status, 200);
        assert.equal((await t.call(app, 'get', '/admin/getSeasonDates', { headers: https })).status, 200);
    });
    it('charters use the LIVE key and ignore the test key', async () => {
        await t.call(app, 'post', '/charters/create-checkout-session', { body: { ...t.booking({ date: t.day(15) }), charter: 'true' }, headers: https });
        assert.ok(mocks.stripe.keys.includes('sk_live_FAKE'));
        assert.ok(!mocks.stripe.keys.includes('sk_test_FAKE'));
        assert.match(mocks.stripe.created[0].success_url, /^https:\/\/www\.example\.test\/success/);
    });
});
