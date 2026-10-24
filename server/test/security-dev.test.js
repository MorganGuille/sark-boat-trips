// Security headers and CORS when running on a laptop (not production).
const t = require('./helpers');
t.setEnv({ PUBLIC_URL: 'http://myhost.test:3000' });
t.installMocks();
const app = require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

before(() => t.startDb());
after(() => t.stopDb());

const get = (origin) => t.call(app, 'get', '/admin/getSeasonDates', { headers: origin ? { Origin: origin } : {} });
const acao = (res) => res.headers['access-control-allow-origin'];

describe('security headers', () => {
    it('the Content Security Policy lists what the site needs, and no more', async () => {
        const csp = (await get()).headers['content-security-policy'];
        for (const directive of ["default-src 'self'", "script-src 'self'", "script-src-attr 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'", 'frame-src https://player.vimeo.com', "connect-src 'self' https://vimeo.com", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com']) {
            assert.ok(csp.includes(directive), directive);
        }
        assert.doesNotMatch(csp.replace(/https:\/\/[^\s;]+/g, ''), /\*/, 'no wildcards');
        assert.ok(!csp.includes('unsafe-eval'));
        assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
    });
    it('does not force https on a laptop (it would stop http://localhost loading)', async () => {
        assert.ok(!(await get()).headers['content-security-policy'].includes('upgrade-insecure-requests'));
    });
    it('the other protective headers are on, HSTS is as before, and Express does not advertise itself', async () => {
        const h = (await get()).headers;
        assert.equal(h['x-content-type-options'], 'nosniff');
        assert.match(h['x-frame-options'], /SAMEORIGIN/i);
        assert.equal(h['referrer-policy'], 'strict-origin-when-cross-origin');
        assert.match(h['permissions-policy'], /camera=\(\)/);
        assert.equal(h['cross-origin-opener-policy'], 'same-origin');
        assert.equal(h['strict-transport-security'], 'max-age=15552000; includeSubDomains; preload');
        assert.equal(h['x-powered-by'], undefined);
    });
    it('does not redirect to https', async () => {
        assert.equal((await get()).status, 200);
    });
});

describe('CORS on a laptop', () => {
    for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://localhost:5199', 'http://localhost', 'http://myhost.test:3000']) {
        it(`lets ${origin} in`, async () => assert.equal(acao(await get(origin)), origin));
    }
    for (const origin of ['https://evil.example', 'http://localhost.evil.example', 'http://127.0.0.1.evil.example', 'http://evil.example:5173', 'null']) {
        it(`keeps ${origin} out`, async () => assert.equal(acao(await get(origin)), undefined));
    }
    it('a local page may ask permission first, including to send the Authorization header and to use DELETE', async () => {
        const res = await t.call(app, 'options', '/bookings/cancel', { headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'authorization,content-type' } });
        assert.equal(res.status, 204);
        assert.equal(acao(res), 'http://127.0.0.1:5173');
        assert.match(res.headers['access-control-allow-headers'], /authorization/i);
        assert.match(res.headers['access-control-allow-methods'], /DELETE/);
    });
    it('never shares cookies across sites', async () => {
        assert.equal((await get('http://localhost:5173')).headers['access-control-allow-credentials'], undefined);
    });
});
