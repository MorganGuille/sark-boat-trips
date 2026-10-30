// Limits that stop bots using the public forms to send email or fill the trips.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

before(() => t.startDb());
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); mocks.reset(); });

const bad = (email = `x${Math.random()}@example.test`) => ({ ...t.booking({ email }), phone: '' }); // refused by validation, so nothing is saved
const statuses = async (n, make) => { const out = []; for (let i = 0; i < n; i++) out.push((await make(i)).status); return out; };

describe('bookings', () => {
    it('one visitor gets 10 attempts in 15 minutes, the 11th is blocked with a readable message and rate-limit headers', async () => {
        const ip = '198.51.100.1';
        const codes = await statuses(11, () => t.call(app, 'post', '/bookings/checkout', { body: bad(), ip }));
        assert.deepEqual(codes, [...Array(10).fill(400), 429]);
        const blocked = await t.call(app, 'post', '/bookings/checkout', { body: bad(), ip });
        assert.match(blocked.body.data, /Too many booking attempts/);
        assert.ok(Object.keys(blocked.headers).some((h) => h.startsWith('ratelimit')));
        assert.equal((await t.call(app, 'post', '/bookings/checkout', { body: bad(), ip: '198.51.100.2' })).status, 400, 'a different visitor is not affected');
    });
    it('one email address gets 3 requests an hour even from 4 different visitors (aimed at a full trip so nothing is emailed)', async () => {
        await t.insertBooking({ date: t.day(10), adults: 12 });
        const victim = 'victim@example.test';
        const results = [];
        for (let i = 0; i < 4; i++) results.push(await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ email: victim }) }));
        assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 429]);
        assert.match(results[3].body.data, /this email address/);
        assert.equal((await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ email: 'someone.else@example.test' }) })).status, 200);
        assert.equal(mocks.mails.length, 0);
    });
    it('the email limit ignores capital letters', async () => {
        await t.insertBooking({ date: t.day(10), adults: 12 });
        const codes = await statuses(4, (i) => t.call(app, 'post', '/bookings/checkout', { body: t.booking({ email: i % 2 ? 'CASE@example.test' : 'case@example.test' }) }));
        assert.deepEqual(codes, [200, 200, 200, 429]);
    });
});

describe('the other public endpoints', () => {
    it('availability: 60 requests a minute, the 61st is blocked', async () => {
        const ip = '198.51.100.20';
        const codes = await Promise.all([...Array(61)].map(() => t.call(app, 'post', '/bookings/monthAvailability', { body: { dates: [t.day(10)] }, ip }).then((r) => r.status)));
        assert.equal(codes.filter((c) => c === 200).length, 60);
        assert.equal(codes.filter((c) => c === 429).length, 1);
    });
    it('charter checkout: 10 attempts in 15 minutes, the 11th is blocked', async () => {
        const ip = '198.51.100.30';
        const codes = await statuses(11, () => t.call(app, 'post', '/charters/create-checkout-session', { body: bad(), ip }));
        assert.deepEqual(codes, [...Array(10).fill(400), 429]);
    });
    it('payment check: 30 requests in 15 minutes, the 31st is blocked', async () => {
        const ip = '198.51.100.40';
        const codes = await statuses(31, () => t.call(app, 'get', '/charters/verify-payment?session_id=cs_test_nope', { ip }));
        assert.deepEqual(codes, [...Array(30).fill(404), 429]);
    });
    it('Stripe\'s webhook is never rate limited (its signature protects it instead)', async () => {
        const codes = await Promise.all([...Array(40)].map(() => t.webhook(app, t.cardSession('cs_test_x'), { signature: 't=1,v1=x' }).then((r) => r.status)));
        assert.ok(codes.every((c) => c !== 429));
    });
});
