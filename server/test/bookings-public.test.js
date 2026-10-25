// A customer booking a trip on the website, and how the seats are counted.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); mocks.reset(); });

const add = (body, opts) => t.call(app, 'post', '/bookings/add', { body, ...opts });
const saved = () => db.collection('bookings').find({}).toArray();

describe('a customer makes a booking', () => {
    it('is saved, and the customer and the owner are both emailed', async () => {
        const body = t.booking();
        const res = await add(body);
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /Thanks Alice, your booking for 2 adults on .* at 11am has been reserved/);
        assert.match(res.body.data, /check your email/);
        assert.doesNotMatch(res.body.data, /\s{2,}/, 'no stray spaces or line breaks in the message');

        const [b] = await saved();
        assert.deepEqual([b.date, b.timeslot, b.firstName, b.lastName, b.email, b.phone, b.adults, b.children, b.status], [body.date, '11am', 'Alice', 'Smith', body.email, body.phone, 2, 0, 'active']);

        assert.equal(mocks.sent().length, 2);
        assert.ok(mocks.sent(body.email).some((m) => m.subject === 'Booking Confirmation Sark Boat Trips'));
        assert.ok(mocks.sent(t.OWNER).some((m) => m.subject === `New Booking ${t.shown(body.date)}`));
        // the customer reads the date day-month-year, never as it is stored
        const confirmation = mocks.sent(body.email).find((m) => m.subject === 'Booking Confirmation Sark Boat Trips');
        assert.ok(confirmation.html.includes(`on ${t.shown(body.date)} at 11am`));
        assert.ok(!confirmation.html.includes(body.date), 'the stored YYYY-MM-DD form is not shown to the customer');
    });

    it('a family with children reads correctly', async () => {
        const res = await add(t.booking({ adults: '2', children: '3' }));
        assert.match(res.body.data, /2 adults and 3 children/);
    });

    it('cannot choose its own status: a booking sent as "cancelled" is saved as active', async () => {
        await add(t.booking({ status: 'cancelled', cancelledAt: '2020-01-01' }));
        const [b] = await saved();
        assert.equal(b.status, 'active');
        assert.equal(b.cancelledAt, undefined);
    });

    it('a bot that fills in the hidden field gets a normal-looking reply, and nothing is saved or emailed', async () => {
        const res = await add(t.booking({ website_url: 'http://spam.example' }));
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.equal((await saved()).length, 0);
        assert.equal(mocks.mails.length, 0);
    });
});

describe('a booking that is refused is never saved and never emailed', () => {
    const refused = [
        ['a missing phone number', { phone: '' }, /required fields/],
        ['a missing last name', { lastName: '  ' }, /required fields/],
        ['no email address', { email: undefined }, /required fields/],
        ['an email that is not an email', { email: 'not-an-email' }, /valid email/],
        ['a very long message', { message: 'x'.repeat(1500) }, /too long/],
        ['13 adults', { adults: '13' }, /between 1 and 12 adults/],
        ['no adults', { adults: '0' }, /required fields/],
        ['2.5 adults', { adults: '2.5' }, /adults/],
        ['adults sent as a list', { adults: ['2'] }, /./],
        ['13 children', { children: '13' }, /between 0 and 12 children/],
        ['negative children', { children: '-1' }, /children/],
        ['an unknown trip time', { timeslot: '3pm' }, /valid trip time/],
        ['a trip time that is a built-in word', { timeslot: 'toString' }, /valid trip time/],
        ['a long built-in word as the trip time', { timeslot: 'constructor' }, /./],
        ['an impossible date', { date: '2033-02-31' }, /valid date/],
        ['a date written the old way round (dd-mm-yyyy)', { date: '15-06-2033' }, /valid date/],
        ['a date sent as a list', { date: [t.day(10)] }, /./],
        ['yesterday', { date: t.day(-1) }, /already passed/],
        ['a date before the season starts', { date: t.day(-40) }, /already passed|only taken between/],
        ['a date after the season ends', { date: t.day(250) }, /only taken between/],
    ];
    for (const [name, override, message] of refused) {
        it(`${name} (400)`, async () => {
            const res = await add(t.booking(override));
            assert.equal(res.status, 400);
            assert.equal(res.body.ok, false);
            assert.match(res.body.data, message);
            assert.equal((await saved()).length, 0);
            assert.equal(mocks.mails.length, 0);
        });
    }
    it('names the season when the date is outside it', async () => {
        const res = await add(t.booking({ date: t.day(250) }));
        assert.match(res.body.data, /Bookings are only taken between \d+ \w+ \d{4} and \d+ \w+ \d{4}/);
    });
    it('with no season set at all, bookings are not open', async () => {
        await require('../models/admin').deleteMany({});
        const res = await add(t.booking());
        assert.equal(res.status, 400);
        assert.match(res.body.data, /aren't open yet/);
        await require('mongoose').connection.db.collection('admins').insertOne({ seasonStartDate: new Date(Date.now() - 30 * 864e5), seasonEndDate: new Date(Date.now() + 200 * 864e5) });
    });
});

describe('seats', () => {
    it('a trip with no bookings has 12 seats on each trip, and the two trips are counted separately', async () => {
        assert.deepEqual(await t.seatsLeft(app, t.day(10)), { '11am': 12, '2pm': 12 });
        await add(t.booking({ timeslot: '11am', adults: '4' }));
        assert.deepEqual(await t.seatsLeft(app, t.day(10)), { '11am': 8, '2pm': 12 });
    });
    it('adults and children both use a seat', async () => {
        await add(t.booking({ adults: '2', children: '3' }));
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 7);
    });
    it('when the trip is full the booking is refused politely, nothing saved or emailed', async () => {
        await t.insertBooking({ date: t.day(10), adults: 12 });
        const res = await add(t.booking());
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /No spaces available at 11am/);
        assert.equal((await saved()).length, 1);
        assert.equal(mocks.mails.length, 0);
    });
    it('a party bigger than the seats left is refused, and one that exactly fits is accepted', async () => {
        await t.insertBooking({ date: t.day(10), adults: 9 });
        assert.equal((await add(t.booking({ adults: '4' }))).body.ok, false);
        assert.equal((await add(t.booking({ adults: '3' }))).body.ok, true);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 0);
    });
    it('cancelled bookings give their seats back', async () => {
        await t.insertBooking({ date: t.day(10), adults: 5, status: 'cancelled' });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 12);
    });
    it('older bookings with no status field still count as active', async () => {
        const id = await t.insertBooking({ date: t.day(10), adults: 5 });
        await db.collection('bookings').updateOne({ _id: (await t.findBooking(id))._id }, { $unset: { status: '' } });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 7);
    });
    it('a booking with no children recorded does not turn the count into nonsense', async () => {
        const id = await t.insertBooking({ date: t.day(10), adults: 3 });
        await db.collection('bookings').updateOne({ _id: (await t.findBooking(id))._id }, { $unset: { children: '' } });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 9);
    });
    it('a charter takes the whole trip whatever its party size, and the other trip is untouched', async () => {
        await t.insertBooking({ date: t.day(10), adults: 2, charter: 'true' });
        assert.deepEqual(await t.seatsLeft(app, t.day(10)), { '11am': 0, '2pm': 12 });
        assert.equal((await add(t.booking({ adults: '1' }))).body.ok, false);
    });
    it('the owner can change a trip\'s capacity, and 0 closes it', async () => {
        const set = (capacity) => t.call(app, 'post', '/bookings/updateavailability', { token, body: { date: t.day(10), timeslot: '11am', capacity } });
        assert.equal((await set('8')).body.ok, true);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 8);
        assert.equal((await set('0')).body.ok, true);
        assert.equal((await add(t.booking({ adults: '1' }))).body.ok, false);
        assert.deepEqual(await t.seatsLeft(app, t.day(11)), { '11am': 12, '2pm': 12 }, 'other days are untouched');
    });
    it('capacity settings must make sense', async () => {
        for (const body of [{ date: '2033-02-31', timeslot: '11am', capacity: '5' }, { date: t.day(10), timeslot: 'x', capacity: '5' }, ...['-1', 'abc', '', '1000', '2.5'].map((capacity) => ({ date: t.day(10), timeslot: '11am', capacity }))]) {
            assert.equal((await t.call(app, 'post', '/bookings/updateavailability', { token, body })).status, 400, JSON.stringify(body));
        }
    });
    it('the calendar endpoint takes at most a month of well-formed dates', async () => {
        const month = [...Array(31)].map((_, i) => t.day(i));
        const ask = (dates) => t.call(app, 'post', '/bookings/monthAvailability', { body: { dates } });
        assert.equal((await ask(month)).status, 200);
        for (const bad of [[...month, t.day(40)], [], 'x', { $ne: null }, ['not-a-date'], [5], ['15-06-2033'], [`${t.day(1)}T10:00`]]) assert.equal((await ask(bad)).status, 400, JSON.stringify(bad));
    });
});
