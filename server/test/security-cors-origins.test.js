// Production with another website deliberately let in through CORS_ORIGINS.
const t = require('./helpers');
t.setEnv({ NODE_ENV: 'production', PUBLIC_URL: 'https://www.example.test', CORS_ORIGINS: 'https://other.example/' });
t.installMocks();
const app = require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

before(() => t.startDb());
after(() => t.stopDb());
const get = (origin) => t.call(app, 'get', '/admin/getSeasonDates', { headers: { 'X-Forwarded-Proto': 'https', Origin: origin } });
const acao = (res) => res.headers['access-control-allow-origin'];

describe('CORS_ORIGINS in production', () => {
    it('lets the listed site in, even though it was typed with a trailing slash', async () => assert.equal(acao(await get('https://other.example')), 'https://other.example'));
    it('still keeps strangers out', async () => assert.equal(acao(await get('https://evil.example')), undefined));
    it('still keeps local pages out', async () => {
        for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173']) assert.equal(acao(await get(origin)), undefined, origin);
    });
});
