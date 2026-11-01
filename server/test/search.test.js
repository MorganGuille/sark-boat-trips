// The dashboard's search (name, email, phone or reference, and dates) and the upcoming bookings list (spec P2-3).
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

const get = (path) => t.call(app, 'get', path, { token });
const names = async (path) => {
    const res = await get(path);
    assert.equal(res.status, 200, `${path}: ${JSON.stringify(res.body)}`);
    return res.body.data.map((b) => b.firstName);
};
// 'YYYY-MM-DD' n days from today in Guernsey, as the server counts
const fromToday = (n) => {
    const date = new Date(`${guernseyToday()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
};
const book = (fields) => t.insertBooking({ date: fromToday(3), lastName: 'Other', email: 'x@example.test', phone: '01481 000000', ...fields });

describe('search', () => {
    it('finds a booking by first name, last name, full name or part of the email, in any case', async () => {
        await book({ firstName: 'Ann', lastName: 'Le Page', email: 'annie.lp@example.test' });
        await book({ firstName: 'Bob', lastName: 'Smith', email: 'bob@mail.test' });
        assert.deepEqual(await names('/bookings/search?q=ann'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=le%20page'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=Ann%20Le%20Page'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=mail.test'), ['Bob']);
        assert.deepEqual(await names('/bookings/search?q=ann%20smith'), [], 'every word must match the same booking');
    });

    it('finds a phone number whatever its spaces, and with or without +44 or the leading 0', async () => {
        await book({ firstName: 'Ann', phone: '+44 7700 900123' });
        await book({ firstName: 'Bob', phone: '07781123456' });
        assert.deepEqual(await names('/bookings/search?q=07700%20900123'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=%2B447700900123'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=900%20123'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=%2B44%207781%20123456'), ['Bob']);
    });

    it('finds a booking reference with or without the SBT-', async () => {
        await book({ firstName: 'Ann', reference: 'SBT-7K3F9Q' });
        await book({ firstName: 'Bob', reference: 'SBT-M4P2XA' });
        assert.deepEqual(await names('/bookings/search?q=7k3f9q'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=SBT-M4P2XA'), ['Bob']);
    });

    it('treats what is typed as plain text: symbols are searched for, not used as a pattern', async () => {
        await book({ firstName: 'Ann', email: 'ann+boat@example.test' });
        await book({ firstName: 'Bob' });
        assert.deepEqual(await names('/bookings/search?q=ann%2Bboat'), ['Ann']);
        assert.deepEqual(await names('/bookings/search?q=.*'), [], '".*" would match everyone as a pattern');
        assert.equal((await get('/bookings/search?q=(')).status, 200, 'a broken pattern is just text');
    });

    it('narrows to dates, or lists everything between two dates when nothing is typed, in date order', async () => {
        await book({ firstName: 'Late', lastName: 'Smith', date: fromToday(20) });
        await book({ firstName: 'Early', lastName: 'Smith', date: fromToday(2) });
        await book({ firstName: 'Mid', lastName: 'Jones', date: fromToday(10) });
        assert.deepEqual(await names(`/bookings/search?q=smith&from=${fromToday(5)}`), ['Late']);
        assert.deepEqual(await names(`/bookings/search?from=${fromToday(1)}&to=${fromToday(15)}`), ['Early', 'Mid']);
        assert.deepEqual(await names(`/bookings/search?to=${fromToday(10)}`), ['Early', 'Mid']);
    });

    it('hides cancelled bookings unless asked, and sends the amount due and trip time like the day view', async () => {
        await book({ firstName: 'Ann', lastName: 'Smith', adults: 2, prices: { adult: 4000, child: 2500, charter: 40000 } });
        await book({ firstName: 'Gone', lastName: 'Smith', status: 'cancelled' });
        const res = await get('/bookings/search?q=smith');
        assert.deepEqual(res.body.data.map((b) => b.firstName), ['Ann']);
        assert.equal(res.body.data[0].amountDue, 8000);
        assert.equal(res.body.data[0].tripLabel, '11am');
        assert.equal((await get('/bookings/search?q=smith&includeCancelled=true')).body.data.length, 2);
    });

    it('refuses an empty search, a bad date, and dates the wrong way round, with a reason', async () => {
        for (const [path, reason] of [
            ['/bookings/search', /Type a name/],
            ['/bookings/search?q=%20%20', /Type a name/],
            ['/bookings/search?from=01-05-2027', /Invalid date/],
            [`/bookings/search?from=${fromToday(9)}&to=${fromToday(2)}`, /after the "to" date/],
        ]) {
            const res = await get(path);
            assert.equal(res.status, 400, path);
            assert.match(res.body.data, reason, path);
        }
    });
});

describe('upcoming bookings', () => {
    it('lists the next 7 days from today (Guernsey time), today included, in date order', async () => {
        await book({ firstName: 'Yesterday', date: fromToday(-1) });
        await book({ firstName: 'Sixth', date: fromToday(6) });
        await book({ firstName: 'Today', date: fromToday(0) });
        await book({ firstName: 'Seventh', date: fromToday(7) });
        assert.deepEqual(await names('/bookings/upcoming'), ['Today', 'Sixth']);
        assert.deepEqual(await names('/bookings/upcoming?days=7'), ['Today', 'Sixth']);
    });

    it('can look 14 or 30 days ahead, or show everything to come', async () => {
        for (const n of [0, 10, 20, 100]) await book({ firstName: `Day${n}`, date: fromToday(n) });
        assert.deepEqual(await names('/bookings/upcoming?days=14'), ['Day0', 'Day10']);
        assert.deepEqual(await names('/bookings/upcoming?days=30'), ['Day0', 'Day10', 'Day20']);
        assert.deepEqual(await names('/bookings/upcoming?days=all'), ['Day0', 'Day10', 'Day20', 'Day100']);
    });

    it('puts each day\'s trips in time order, hides cancelled bookings unless asked, and refuses other numbers', async () => {
        await book({ firstName: 'Afternoon', date: fromToday(1), timeslot: '2pm' });
        await book({ firstName: 'Morning', date: fromToday(1), timeslot: '11am' });
        await book({ firstName: 'Gone', date: fromToday(1), status: 'cancelled' });
        assert.deepEqual(await names('/bookings/upcoming'), ['Morning', 'Afternoon']);
        assert.equal((await get('/bookings/upcoming?includeCancelled=true')).body.data.length, 3);
        assert.equal((await get('/bookings/upcoming?days=365')).status, 400);
    });
});
