// Who is allowed to do what: the login, and which routes need a token.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

let token;
before(async () => { await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());

describe('logging in', () => {
    it('the right username and password give a token', async () => {
        const res = await t.call(app, 'post', '/admin/login', { body: { userName: t.USERNAME, password: t.PASSWORD } });
        assert.equal(res.status, 200);
        assert.ok(res.body.ok && res.body.token);
        const { exp, iat } = jwt.decode(res.body.token);
        assert.equal(exp - iat, 8 * 3600, 'a token lasts 8 hours');
    });
    it('a wrong password, a wrong username and an empty request are all refused', async () => {
        for (const body of [{ userName: t.USERNAME, password: 'nope' }, { userName: 'someone', password: t.PASSWORD }, {}, { userName: t.USERNAME }]) {
            const res = await t.call(app, 'post', '/admin/login', { body });
            assert.equal(res.status, 401, JSON.stringify(body));
            assert.equal(res.body.token, undefined);
        }
    });
    it('lists, objects and other odd values are refused rather than crashing', async () => {
        for (const body of [{ userName: { $ne: null }, password: { $ne: null } }, { userName: [t.USERNAME], password: [t.PASSWORD] }, { userName: 5, password: 5 }]) {
            const res = await t.call(app, 'post', '/admin/login', { body });
            assert.equal(res.status, 401, JSON.stringify(body));
            assert.equal(res.body.token, undefined);
        }
    });
    it('the 6th attempt from one visitor in 15 minutes is blocked, but another visitor is not', async () => {
        const ip = '203.0.113.50';
        const codes = [];
        for (let i = 0; i < 6; i++) codes.push((await t.call(app, 'post', '/admin/login', { body: { userName: 'x', password: 'y' }, ip })).status);
        assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
        assert.equal((await t.call(app, 'post', '/admin/login', { body: { userName: t.USERNAME, password: t.PASSWORD } })).status, 200);
    });
});

// Every route that touches customer data or changes anything
const PROTECTED = [
    ['post', '/bookings/admin-add', { date: t.day(5), timeslot: '11am' }],
    ['post', '/bookings/cancel', { _id: '64b000000000000000000000' }],
    ['post', '/bookings/restore', { _id: '64b000000000000000000000' }],
    ['post', '/bookings/permanently-delete', { _id: '64b000000000000000000000' }],
    ['post', '/bookings/mark-paid', { _id: '64b000000000000000000000' }],
    ['post', '/bookings/mark-unpaid', { _id: '64b000000000000000000000' }],
    ['post', '/bookings/update/64b000000000000000000000', { phone: '1' }],
    ['post', '/bookings/updateavailability', { date: t.day(5), timeslot: '11am', capacity: '5' }],
    ['get', `/bookings/${t.day(5)}`],
    ['get', '/bookings/search/smith'],
    ['post', '/notes', { date: t.day(5), content: 'hello' }],
    ['get', `/notes/${t.day(5)}`],
    ['delete', '/notes/64b000000000000000000000'],
    ['post', '/admin/setSeasonDates', { seasonStartDate: '2030-01-01', seasonEndDate: '2030-02-01' }],
    ['post', '/admin/setPrices', { adultPrice: '40', childPrice: '25', charterPrice: '400' }],
    ['get', '/bookings/report/2030-06'],
    ['get', '/bookings/report/2030-06?format=csv'],
];

describe('routes that need a login', () => {
    const forgeries = {
        'no token at all': () => undefined,
        'a made-up token': () => 'abc.def.ghi',
        'a real token with one letter changed': () => `${token}x`,
        'an expired token': () => jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: -10 }),
        'a token signed with the wrong secret': () => jwt.sign({ role: 'admin' }, 'some other secret'),
        'a token with the signature removed (alg: none)': () => `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"role":"admin"}').toString('base64url')}.`,
    };
    for (const [name, make] of Object.entries(forgeries)) {
        it(`all ${PROTECTED.length} are refused with ${name}`, async () => {
            for (const [method, path, body] of PROTECTED) {
                const res = await t.call(app, method, path, { body, token: make() });
                assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
            }
        });
    }
    it('none of them are refused with a real token', async () => {
        for (const [method, path, body] of PROTECTED) {
            const res = await t.call(app, method, path, { body, token });
            assert.notEqual(res.status, 401, `${method.toUpperCase()} ${path}`);
        }
    });
    it('a token sent in the wrong place does not count', async () => {
        const res = await t.call(app, 'get', '/bookings/search/smith', { headers: { Cookie: `token=${token}`, 'X-Token': token } });
        assert.equal(res.status, 401);
    });
});

describe('routes anyone can use', () => {
    it('season dates, availability and booking reach their own checks, not a login wall', async () => {
        assert.equal((await t.call(app, 'get', '/admin/getSeasonDates')).status, 200);
        assert.equal((await t.call(app, 'get', '/admin/getPrices')).status, 200);
        assert.equal((await t.call(app, 'post', '/bookings/monthAvailability', { body: { dates: [t.day(5)] } })).status, 200);
        assert.equal((await t.call(app, 'post', '/bookings/checkout', { body: {} })).status, 400);
        assert.equal((await t.call(app, 'get', '/charters/verify-payment')).status, 400);
    });
});
