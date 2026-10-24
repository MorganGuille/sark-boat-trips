// The safety switch: CSP_REPORT_ONLY=true makes the browser log problems instead of blocking.
const t = require('./helpers');
t.setEnv({ CSP_REPORT_ONLY: 'true' });
t.installMocks();
const app = require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

before(() => t.startDb());
after(() => t.stopDb());

describe('CSP_REPORT_ONLY=true', () => {
    it('sends the policy as report-only, so nothing is blocked, and not as an enforced one', async () => {
        const h = (await t.call(app, 'get', '/admin/getSeasonDates')).headers;
        assert.match(h['content-security-policy-report-only'], /default-src 'self'/);
        assert.equal(h['content-security-policy'], undefined);
    });
    it('the other headers are unaffected', async () => {
        const h = (await t.call(app, 'get', '/admin/getSeasonDates')).headers;
        assert.equal(h['x-content-type-options'], 'nosniff');
    });
});
