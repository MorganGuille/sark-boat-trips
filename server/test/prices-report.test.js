// Ticket prices (set by the owner, saved on every booking) and the monthly passenger and income report.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { toPence, bookingValue } = require('../utils/prices');
const { buildReport, toCsv, isMonth } = require('../utils/report');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const setPrices = (body, opts = { token }) => t.call(app, 'post', '/admin/setPrices', { body, ...opts });
const getPrices = () => t.call(app, 'get', '/admin/getPrices');
const ALL = { adultPrice: '40', childPrice: '25', charterPrice: '400' };
const settings = () => db.collection('admins').findOne({});
const report = (month, query = '') => t.call(app, 'get', `/bookings/report/${month}${query}`, { token });

describe('prices: the pure rules', () => {
    it('turns pounds into whole pence, and refuses anything that is not a price', () => {
        assert.equal(toPence('40'), 4000);
        assert.equal(toPence(12.5), 1250);
        assert.equal(toPence('12.50'), 1250);
        assert.equal(toPence('0'), 0);
        assert.equal(toPence('10000'), 1000000);
        assert.equal(toPence('0.07'), 7);
        for (const bad of ['', ' ', 'abc', '-1', '1e3', '40.123', '10000.01', '10001', '4 0', null, undefined, ['40'], { a: 1 }, true, NaN]) assert.equal(toPence(bad), null, String(JSON.stringify(bad)));
    });
    it('a trip is worth adults and children at their prices, a charter the flat price, infants nothing', () => {
        const prices = { adult: 4000, child: 2500, charter: 40000 };
        assert.equal(bookingValue({ adults: 5, children: 1, charter: 'false' }, prices), 22500);
        assert.equal(bookingValue({ adults: 11, children: 3, charter: 'true' }, prices), 40000);
        assert.equal(bookingValue({ adults: 2 }, prices), 8000);
    });
    it('uses the prices saved on the booking, falling back to the current ones, or says it cannot tell', () => {
        const saved = { adult: 3000, child: 2000, charter: 30000 };
        const now = { adult: 4000, child: 2500, charter: 40000 };
        assert.equal(bookingValue({ adults: 1, children: 0, prices: saved }, now), 3000);
        assert.equal(bookingValue({ adults: 1, children: 0 }, now), 4000);
        assert.equal(bookingValue({ adults: 1, children: 0 }, null), null);
        assert.equal(bookingValue({ adults: 1, children: 0, prices: { adult: 3000 } }, now), 4000, 'half-saved prices are ignored');
    });
});

describe('setting and reading prices', () => {
    it('anyone can read them (the booking page shows them), in pounds', async () => {
        await setPrices(ALL);
        const res = await getPrices();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.prices, { adult: 40, child: 25, charter: 400 });
    });
    it('the owner can change them, including pence, and they are stored as whole pence', async () => {
        const res = await setPrices({ adultPrice: '42.50', childPrice: 27, charterPrice: '450.00' });
        assert.equal(res.body.ok, true);
        assert.deepEqual(res.body.prices, { adult: 42.5, child: 27, charter: 450 });
        const doc = await settings();
        assert.deepEqual([doc.adultPrice, doc.childPrice, doc.charterPrice], [4250, 2700, 45000]);
        assert.equal(await db.collection('admins').countDocuments({}), 1, 'still a single settings record');
    });
    it('before they are set, the answer is "no prices yet" rather than an error', async () => {
        await db.collection('admins').updateOne({}, { $unset: { adultPrice: '', childPrice: '', charterPrice: '' } });
        const res = await getPrices();
        assert.equal(res.status, 200);
        assert.equal(res.body.prices, null);
    });
    it('missing, negative, garbled, over-precise or list-shaped prices are refused, and nothing changes', async () => {
        const before = (await getPrices()).body;
        const bad = [{}, { adultPrice: '40', childPrice: '25' }, { ...ALL, adultPrice: '-1' }, { ...ALL, childPrice: 'free' }, { ...ALL, charterPrice: '' },
            { ...ALL, adultPrice: '40.999' }, { ...ALL, adultPrice: '10001' }, { ...ALL, adultPrice: ['40'] }, { ...ALL, childPrice: { $gt: 0 } }];
        for (const body of bad) {
            const res = await setPrices(body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.match(res.body.data, /amount in pounds/);
        }
        assert.deepEqual((await getPrices()).body, before);
    });
    it('only the owner can change them', async () => {
        assert.equal((await setPrices({ ...ALL, adultPrice: '1' }, {})).status, 401);
        assert.equal((await getPrices()).body.prices.adult, 40);
    });
    it('prices and season dates can be set in either order without losing each other', async () => {
        await db.collection('admins').deleteMany({});
        assert.equal((await setPrices(ALL)).body.ok, true);
        assert.equal((await t.call(app, 'get', '/admin/getSeasonDates')).status, 404, 'prices alone are not a season');
        const closed = await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ date: t.day(10) }) });
        assert.equal(closed.status, 400);
        assert.match(closed.body.data, /aren't open yet/);
        assert.equal((await t.call(app, 'post', '/admin/setSeasonDates', { token, body: { seasonStartDate: '2031-05-01', seasonEndDate: '2031-09-30' } })).body.ok, true);
        assert.deepEqual((await getPrices()).body.prices, { adult: 40, child: 25, charter: 400 });
        await setPrices({ ...ALL, adultPrice: '41' });
        assert.deepEqual((await t.call(app, 'get', '/admin/getSeasonDates')).body.seasonStartDate, '2031-05-01');
    });
});

describe('every booking keeps the prices it was made at', () => {
    const saved = async () => db.collection('bookings').find({}).sort({ _id: 1 }).toArray();

    it('a customer booking saves the current prices, and a later price change does not touch it', async () => {
        assert.ok((await t.bookOnline(app, t.booking({ date: t.day(10) }))).booking);
        await setPrices({ adultPrice: '50', childPrice: '30', charterPrice: '500' });
        assert.ok((await t.bookOnline(app, t.booking({ date: t.day(11) }))).booking);
        const [first, second] = await saved();
        assert.deepEqual(first.prices, { adult: 4000, child: 2500, charter: 40000 });
        assert.deepEqual(second.prices, { adult: 5000, child: 3000, charter: 50000 });
    });
    it('a booking added on the dashboard saves them too', async () => {
        const res = await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(10), timeslot: '11am', adults: '2' } });
        assert.equal(res.body.ok, true);
        assert.deepEqual((await saved())[0].prices, { adult: 4000, child: 2500, charter: 40000 });
    });
    it('a customer cannot choose the prices, make themselves a charter, or set payment fields', async () => {
        const { res, session } = await t.bookOnline(app, { ...t.booking({ date: t.day(10) }), prices: { adult: 1, child: 1, charter: 1 }, charter: 'true', kind: 'charter', stripeSessionId: 'cs_free', status: 'cancelled', cancelledAt: '2020-01-01', paymentStatus: 'paid', amountPaid: 99999, stripePaymentMethodId: 'pm_x' });
        assert.equal(res.body.ok, true);
        const [booking] = await saved();
        assert.equal(booking.stripeSessionId, session.id, 'only the real Stripe session');
        assert.deepEqual(booking.prices, { adult: 4000, child: 2500, charter: 40000 });
        assert.notEqual(booking.charter, 'true', 'a charter can only come from a paid checkout');
        assert.equal(booking.status, 'active');
        assert.equal(booking.cancelledAt, undefined);
        assert.equal(booking.paymentStatus, 'card_saved', 'a customer cannot say they have paid');
        assert.equal(booking.amountPaid, undefined);
        assert.equal(booking.stripePaymentMethodId, `pm_for_seti_${session.id}`, 'only the card Stripe saved');
    });
    it('with no prices set yet, online booking is closed, but a dashboard booking is still made (with no prices saved on it)', async () => {
        await db.collection('admins').updateOne({}, { $unset: { adultPrice: '', childPrice: '', charterPrice: '' } });
        assert.equal((await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ date: t.day(10) }) })).status, 503);
        assert.equal((await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(10), timeslot: '11am', adults: '2' } })).body.ok, true);
        assert.equal((await saved())[0].prices, undefined);
    });
});

describe('the monthly report', () => {
    const put = (date, adults, children = 0, extra = {}) => t.insertBooking({ date, adults, children, ...extra });

    it('adds up each day and the month, with cancelled bookings left out', async () => {
        await put('2030-06-10', 5, 1);
        await put('2030-06-10', 2, 0);
        await put('2030-06-15', 1, 0, { status: 'cancelled' });
        await put('2030-06-20', 10, 0);
        const res = await report('2030-06');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.days, [
            { date: '2030-06-10', adults: 7, children: 1, infants: 0, charters: 0, income: 7 * 4000 + 2500, unpaid: 7 * 4000 + 2500, unpaidBookings: 2 },
            { date: '2030-06-20', adults: 10, children: 0, infants: 0, charters: 0, income: 40000, unpaid: 40000, unpaidBookings: 1 },
        ]);
        // (nothing here is marked paid, so all of the income is still to pay)
        assert.deepEqual(res.body.total, { adults: 17, children: 1, infants: 0, charters: 0, income: 17 * 4000 + 2500, unpaid: 17 * 4000 + 2500, unpaidBookings: 3 });
    });
    it('says how much of the income is not marked paid yet: a card still to charge, a failed card, cash to collect', async () => {
        await put('2030-06-10', 2, 0, { paymentStatus: 'paid', amountPaid: 8000 });
        await put('2030-06-10', 1, 0, { paymentStatus: 'paid_in_person', amountPaid: 4000 });
        await put('2030-06-10', 1, 1, { paymentStatus: 'card_saved' }); // £65, charged when the trip starts
        await put('2030-06-11', 1, 0, { paymentStatus: 'unpaid', paymentNote: 'The card was declined.' }); // £40
        await put('2030-06-11', 3, 0); // a phone booking, no status at all: £120
        await put('2030-06-11', 2, 0, { paymentStatus: 'voucher', voucher: { code: 'GIFT-AAAA-AA', value: 8000 } }); // nothing left to pay
        await put('2030-06-12', 2, 0, { paymentStatus: 'card_saved', status: 'cancelled' }); // cancelled: never counts
        const { body } = await report('2030-06');
        assert.deepEqual(body.days.map((d) => [d.date, d.income, d.unpaid, d.unpaidBookings]), [
            ['2030-06-10', 12000 + 6500, 6500, 1],
            ['2030-06-11', 4000 + 12000, 16000, 2],
        ]);
        assert.deepEqual([body.total.income, body.total.unpaid, body.total.unpaidBookings], [34500, 22500, 3]);
        const csv = (await report('2030-06', '?format=csv')).text.split('\r\n');
        assert.deepEqual(csv.slice(0, 4), [
            'Date,Adults,Children,Infants,Passengers,Charters,Income (GBP),Not yet paid (GBP)',
            '10-06-2030,4,1,0,5,0,185.00,65.00',
            '11-06-2030,6,0,0,6,0,160.00,160.00',
            'Total,10,1,0,11,0,345.00,225.00',
        ]);
    });
    it('counts a charter once, at the flat price, with its people included in adults and children', async () => {
        await put('2030-06-15', 11, 0, { charter: 'true' });
        await put('2030-06-15', 4, 1);
        const { body } = await report('2030-06');
        assert.deepEqual(body.total, { adults: 15, children: 1, infants: 0, charters: 1, income: 40000 + 4 * 4000 + 2500, unpaid: 40000 + 4 * 4000 + 2500, unpaidBookings: 2 });
    });
    it('only counts the month asked for, including its first and last day', async () => {
        await put('2030-05-31', 1);
        await put('2030-06-01', 2);
        await put('2030-06-30', 3);
        await put('2030-07-01', 4);
        assert.equal((await report('2030-06')).body.total.adults, 5);
        assert.equal((await report('2030-05')).body.total.adults, 1);
        assert.equal((await report('2030-07')).body.total.adults, 4);
        assert.equal((await report('2031-06')).body.total.adults, 0);
    });
    it('an old booking is worth what it was when it was made, not today\'s prices', async () => {
        await put('2030-06-10', 2, 0, { prices: { adult: 3000, child: 2000, charter: 30000 } });
        await put('2030-06-11', 2, 0);
        await put('2030-06-12', 1, 0, { charter: 'true', prices: { adult: 3000, child: 2000, charter: 30000 } });
        const { body } = await report('2030-06');
        assert.deepEqual(body.days.map((d) => d.income), [6000, 8000, 30000]);
    });
    it('an edited party size changes the income', async () => {
        const id = await put('2030-06-10', 2, 0);
        await t.call(app, 'post', `/bookings/update/${id}`, { token, body: { adults: '3', children: '2' } });
        assert.equal((await report('2030-06')).body.total.income, 3 * 4000 + 2 * 2500);
    });
    it('a month with no bookings is a row of zeros, even before prices are set', async () => {
        await db.collection('admins').updateOne({}, { $unset: { adultPrice: '', childPrice: '', charterPrice: '' } });
        const res = await report('2030-06');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.total, { adults: 0, children: 0, infants: 0, charters: 0, income: 0, unpaid: 0, unpaidBookings: 0 });
    });
    it('with bookings but no prices anywhere, it says to set the prices rather than show a wrong income', async () => {
        await db.collection('admins').updateOne({}, { $unset: { adultPrice: '', childPrice: '', charterPrice: '' } });
        await put('2030-06-10', 2);
        const res = await report('2030-06');
        assert.equal(res.status, 409);
        assert.match(res.body.data, /Set your adult, child and charter prices first/);
    });
    it('only a real YYYY-MM month is accepted', async () => {
        for (const bad of ['2030-13', '2030-00', '2030-6', 'June', '2030-06-01', '30-06', '2030', 'x']) assert.equal((await report(bad)).status, 400, bad);
        assert.equal(isMonth('2030-12'), true);
        assert.equal(isMonth(['2030-12']), false);
    });
    it('buildReport sorts the days in date order whatever order they come in', () => {
        const days = buildReport([{ date: '2030-06-20', adults: 1 }, { date: '2030-06-03', adults: 1 }, { date: '2030-06-11', adults: 1 }], { adult: 100, child: 50, charter: 1000 }).days.map((d) => d.date);
        assert.deepEqual(days, ['2030-06-03', '2030-06-11', '2030-06-20']);
    });
});

describe('the CSV download', () => {
    it('is a file named for the month, with British dates, two-decimal money and a total row', async () => {
        await t.insertBooking({ date: '2030-06-13', adults: 10, children: 0 });
        await t.insertBooking({ date: '2030-06-14', adults: 5, children: 1, infants: 2 }); // infants are counted but free
        await t.insertBooking({ date: '2030-06-15', adults: 11, children: 0, charter: 'true' });
        const res = await report('2030-06', '?format=csv');
        assert.equal(res.status, 200);
        assert.match(res.headers['content-type'], /^text\/csv/);
        assert.equal(res.headers['content-disposition'], 'attachment; filename="sark-boat-trips-2030-06.csv"');
        assert.equal(res.text, [
            'Date,Adults,Children,Infants,Passengers,Charters,Income (GBP),Not yet paid (GBP)',
            '13-06-2030,10,0,0,10,0,400.00,400.00',
            '14-06-2030,5,1,2,8,0,225.00,225.00',
            '15-06-2030,11,0,0,11,1,400.00,400.00',
            'Total,26,1,2,29,1,1025.00,1025.00',
            '',
        ].join('\r\n'));
    });
    it('an empty month is just the header and a zero total', async () => {
        const res = await report('2030-06', '?format=csv');
        assert.equal(res.text, 'Date,Adults,Children,Infants,Passengers,Charters,Income (GBP),Not yet paid (GBP)\r\nTotal,0,0,0,0,0,0.00,0.00\r\n');
    });
    it('toCsv writes pence as pounds without rounding errors', () => {
        const csv = toCsv({ days: [{ date: '2030-06-01', adults: 1, children: 0, infants: 0, charters: 0, income: 1005 }], total: { adults: 1, children: 0, infants: 0, charters: 0, income: 1005 } });
        assert.match(csv, /01-06-2030,1,0,0,1,0,10\.05,0\.00\r\n/);
    });
});
