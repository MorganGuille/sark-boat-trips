// Customer data tools (spec P2-13, owner's choices 3 Nov 2026): find everything held for one email,
// download it, and erase it: details blanked, dates, parties and money kept, the saved card removed at Stripe.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { guernseyToday } = require('../utils/validateBooking');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token;
before(async () => { await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); mocks.reset(); });

const db = () => require('mongoose').connection.db;
const fromToday = (n) => {
    const date = new Date(`${guernseyToday()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
};
const ANN = { firstName: 'Ann', lastName: 'Le Page', email: 'Ann.LP@Example.test', phone: '07700 900123', message: 'My son uses a wheelchair' };
const past = (fields = {}) => t.insertBooking({ ...ANN, date: fromToday(-30), reference: 'SBT-PAST01', manageToken: 'a'.repeat(32), paymentStatus: 'paid', amountPaid: 8000, prices: { adult: 4000, child: 2500, charter: 40000 }, stripeCustomerId: 'cus_ann', stripePaymentMethodId: 'pm_ann', cardLabel: 'Visa •••• 4242', ...fields });
const voucher = (fields) => db().collection('vouchers').insertOne({ code: 'GIFT-AAAA-AA', kind: 'trip', adults: 2, children: 0, expiresOn: fromToday(300), status: 'unused', paidBy: 'online', amountPaid: 8000, ...fields });
const show = (email) => t.call(app, 'get', `/customers?email=${encodeURIComponent(email)}`, { token });
const eraseIt = (email, confirm = email) => t.call(app, 'post', '/customers/erase', { token, body: { email, confirm } });

describe('finding a customer', () => {
    it('only the owner can see, download or erase anyone', async () => {
        for (const [method, path] of [['get', '/customers?email=a@b.test'], ['get', '/customers/export?email=a@b.test'], ['post', '/customers/erase']]) {
            assert.equal((await t.call(app, method, path, { body: method === 'post' ? {} : undefined })).status, 401, path);
        }
    });

    it('finds their bookings (cancelled too) and gift vouchers bought or received, ignoring capitals, and nobody else\'s', async () => {
        await past();
        await t.insertBooking({ ...ANN, email: ' ann.lp@example.test ', date: fromToday(-10), status: 'cancelled' });
        await t.insertBooking({ firstName: 'Bob', email: 'bob@example.test', date: fromToday(-5) });
        await t.insertBooking({ firstName: 'Eve', email: 'xann.lp@example.test', date: fromToday(-5) }); // a different address that contains hers
        await voucher({ code: 'GIFT-BUYS-AA', buyerName: 'Ann', buyerEmail: 'ann.lp@example.test', recipientName: 'Tom', recipientEmail: 'tom@example.test', deliverTo: 'tom@example.test', sentAt: new Date() });
        await voucher({ code: 'GIFT-GETS-AA', buyerName: 'Sue', buyerEmail: 'sue@example.test', recipientName: 'Ann', recipientEmail: 'ANN.LP@example.test', deliverTo: 'ANN.LP@example.test', sentAt: new Date() });
        const res = await show('ann.lp@EXAMPLE.test');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.bookings.map((b) => b.status), ['active', 'cancelled']);
        assert.equal(res.body.bookings[0].phone, '07700 900123');
        assert.equal(res.body.bookings[0].trip, '11am');
        assert.deepEqual(res.body.vouchers.map((v) => v.code).sort(), ['GIFT-BUYS-AA', 'GIFT-GETS-AA']);
        assert.equal(res.body.eraseProblem, null);
        assert.equal(JSON.stringify(res.body).includes('a'.repeat(32)), false, 'the manage link is a key, never shown');
    });

    it('a pattern in the address is just text, and something that isn\'t an address is refused', async () => {
        await past();
        assert.deepEqual((await show('.*@example.test')).body.bookings, []);
        assert.equal((await show('not an email')).status, 400);
        assert.equal((await t.call(app, 'get', '/customers?email[$ne]=x', { token })).status, 400);
    });

    it('downloads as a file named after them, holding their details', async () => {
        await past();
        const res = await t.call(app, 'get', '/customers/export?email=ann.lp@example.test', { token });
        assert.equal(res.status, 200);
        assert.match(res.headers['content-disposition'], /attachment; filename="sark-boat-trips-ann\.lp@example\.test\.json"/);
        const data = JSON.parse(res.text);
        assert.equal(data.email, 'ann.lp@example.test');
        assert.equal(data.bookings[0].message, 'My son uses a wheelchair');
        assert.equal(data.bookings[0].card, 'Visa •••• 4242');
    });
});

describe('erasing a customer', () => {
    it('blanks their details, keeps the date, party and money, kills the manage link, and removes their card at Stripe', async () => {
        const id = await past();
        await voucher({ code: 'GIFT-BUYS-AA', buyerName: 'Ann', buyerEmail: 'ann.lp@example.test', message: 'Happy birthday Tom', recipientName: 'Tom', recipientEmail: 'tom@example.test', deliverTo: 'tom@example.test', sentAt: new Date() });
        const res = await eraseIt('ann.lp@example.test');
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.match(res.body.data, /Erased ann\.lp@example\.test from 1 booking and 1 gift voucher.*saved card was removed at Stripe/);
        assert.deepEqual(mocks.stripe.deleted, ['cus_ann']);

        const b = await t.findBooking(id);
        assert.deepEqual([b.firstName, b.lastName, b.email, b.phone, b.message], ['Erased', '', '', '', '']);
        assert.deepEqual([b.stripeCustomerId, b.stripePaymentMethodId, b.cardLabel], [undefined, undefined, undefined]);
        assert.deepEqual([b.date, b.adults, b.amountPaid, b.paymentStatus, b.reference], [fromToday(-30), 2, 8000, 'paid', 'SBT-PAST01']);
        assert.ok(b.erasedAt);
        assert.equal((await t.call(app, 'get', `/bookings/manage/${'a'.repeat(32)}`)).status, 404, 'the old manage link no longer works');

        const v = await db().collection('vouchers').findOne({ code: 'GIFT-BUYS-AA' });
        assert.deepEqual([v.buyerName, v.buyerEmail, v.message], ['', '', '']);
        assert.deepEqual([v.recipientName, v.recipientEmail, v.status], ['Tom', 'tom@example.test', 'unused'], 'Tom keeps his voucher');
        assert.deepEqual((await show('ann.lp@example.test')).body.bookings, [], 'nothing is found for her afterwards');
    });

    it('past months\' report stays the same', async () => {
        await past();
        const month = fromToday(-30).slice(0, 7);
        const before = (await t.call(app, 'get', `/bookings/report/${month}`, { token })).body;
        await eraseIt('ann.lp@example.test');
        const after = (await t.call(app, 'get', `/bookings/report/${month}`, { token })).body;
        assert.deepEqual(after, before);
    });

    it('is refused while they have a booking today or later, or a voucher still to be emailed to them', async () => {
        await past();
        await t.insertBooking({ ...ANN, date: fromToday(5), reference: 'SBT-SOON01' });
        let res = await eraseIt('ann.lp@example.test');
        assert.equal(res.status, 409);
        assert.match(res.body.data, /a booking from today on \(SBT-SOON01\)\. Cancel it first/);
        assert.match((await show('ann.lp@example.test')).body.eraseProblem, /SBT-SOON01/);
        assert.deepEqual(mocks.stripe.deleted, [], 'nothing was touched');

        await t.resetDb();
        await voucher({ code: 'GIFT-WAIT-AA', recipientEmail: 'ann.lp@example.test', deliverTo: 'ann.lp@example.test', sendOn: fromToday(20) });
        res = await eraseIt('ann.lp@example.test');
        assert.equal(res.status, 409);
        assert.match(res.body.data, /GIFT-WAIT-AA.*still waiting to be emailed/);
    });

    it('a cancelled future booking doesn\'t stop it', async () => {
        await t.insertBooking({ ...ANN, date: fromToday(5), status: 'cancelled' });
        assert.equal((await eraseIt('ann.lp@example.test')).status, 200);
    });

    it('needs the address typed twice, and says when nothing is held', async () => {
        await past();
        assert.equal((await eraseIt('ann.lp@example.test', 'ann@example.test')).status, 400);
        assert.equal((await t.findBooking(await past({ reference: 'SBT-PAST02' }))).firstName, 'Ann', 'nothing erased');
        assert.equal((await eraseIt('nobody@example.test')).status, 404);
    });

    it('if Stripe can\'t be reached, nothing is erased, so it can simply be tried again', async () => {
        const id = await past();
        mocks.stripe.fail = true;
        const res = await eraseIt('ann.lp@example.test');
        assert.equal(res.status, 503);
        assert.match(res.body.data, /nothing was erased/);
        assert.equal((await t.findBooking(id)).email, 'Ann.LP@Example.test');
        mocks.stripe.fail = false;
        assert.equal((await eraseIt('ann.lp@example.test')).status, 200);
    });
});
