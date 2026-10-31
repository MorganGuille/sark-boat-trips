// Infants (3 and under): free, but they take a seat, because the boat's limit counts every person.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { seatsFor, partyText } = require('../utils/party');
const { bookingValue } = require('../utils/prices');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const PRICES = { adult: 4000, child: 2500, charter: 40000 };

describe('the party rules', () => {
    it('everyone takes a seat, infants included', () => {
        assert.equal(seatsFor({ adults: 2, children: 1, infants: 1 }), 4);
        assert.equal(seatsFor({ adults: '1', infants: '2' }), 3);
        assert.equal(seatsFor({ adults: 2 }), 2, 'a booking with no infants recorded');
    });
    it('infants are free, children pay the child price', () => {
        assert.equal(bookingValue({ adults: 1, children: 0, infants: 2 }, PRICES), 4000);
        assert.equal(bookingValue({ adults: 2, children: 1, infants: 1 }, PRICES), 10500);
        assert.equal(bookingValue({ adults: 6, infants: 3, charter: 'true' }, PRICES), 40000, 'a charter is still the flat price');
    });
    it('a party reads naturally in emails', () => {
        assert.equal(partyText({ adults: 2 }), '2 adults');
        assert.equal(partyText({ adults: 1, children: 1 }), '1 adult and 1 child');
        assert.equal(partyText({ adults: 1, infants: 2 }), '1 adult and 2 infants');
        assert.equal(partyText({ adults: 2, children: 3, infants: 1 }), '2 adults, 3 children and 1 infant');
        assert.equal(partyText({}), '0 adults', 'a dashboard booking with no numbers');
    });
});

describe('booking online with infants', () => {
    it('they are saved, charged nothing, and the emails and Stripe\'s page say so', async () => {
        const body = t.booking({ adults: '1', children: '0', infants: '2' });
        const { booking } = await t.bookOnline(app, body);
        assert.deepEqual([booking.adults, booking.children, booking.infants], [1, 0, 2]);
        assert.match(mocks.stripe.created[0].custom_text.submit.message, /£40 will be charged/);
        const confirmation = mocks.sent(body.email)[0];
        assert.match(confirmation.text, /Party: 1 adult and 2 infants\n/);
        assert.match(confirmation.text, /Payment: £40, charged to your saved card/);
        assert.match(mocks.sent(t.OWNER)[0].text, /Party: 1 adult and 2 infants\n/);
    });
    it('they use seats: a party that only fits without its infants is refused', async () => {
        await t.insertBooking({ date: t.day(10), adults: 10 });
        const refused = await t.bookOnline(app, t.booking({ adults: '1', infants: '2' }));
        assert.equal(refused.res.body.ok, false);
        assert.match(refused.res.body.data, /only 2 spaces left on the 11am trip on .*, and you asked for 3 \(infants take a seat too\)/);
        assert.ok((await t.bookOnline(app, t.booking({ adults: '1', infants: '1' }))).booking);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 0);
    });
    it('a charter can bring infants too', async () => {
        const { booking } = await t.bookOnline(app, t.booking({ date: t.day(12), adults: '4', infants: '1' }), { kind: 'charter' });
        assert.equal(booking.infants, 1);
    });
    for (const [name, infants] of [['13 infants', '13'], ['negative infants', '-1'], ['half an infant', '0.5'], ['infants sent as a list', ['1']]]) {
        it(`${name} is refused`, async () => {
            const res = await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ infants }) });
            assert.equal(res.status, 400);
            assert.match(res.body.data, /infants|check your details/);
            assert.equal(mocks.stripe.created.length, 0);
        });
    }
    it('no infants box at all still works (0 infants)', async () => {
        const body = t.booking();
        delete body.infants;
        const { booking } = await t.bookOnline(app, body);
        assert.equal(booking.infants, 0);
    });
});

describe('infants on the dashboard', () => {
    const edit = (id, body) => t.call(app, 'post', `/bookings/update/${id}`, { token, body });
    it('a dashboard booking saves them and counts their seats', async () => {
        await t.insertBooking({ date: t.day(10), adults: 10 });
        const tooMany = await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(10), timeslot: '11am', adults: '2', infants: '1' } });
        assert.equal(tooMany.body.ok, false);
        const fits = await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: t.day(10), timeslot: '11am', adults: '1', infants: '1' } });
        assert.equal(fits.body.ok, true);
        assert.equal((await db.collection('bookings').findOne({ adults: 1 })).infants, 1);
    });
    it('editing can add or clear infants, and adding them must still fit', async () => {
        const id = await t.insertBooking({ date: t.day(10), adults: 2 });
        await t.insertBooking({ date: t.day(10), adults: 9 });
        assert.equal((await edit(id, { infants: '1' })).body.ok, true);
        assert.equal((await t.findBooking(id)).infants, 1);
        const refused = await edit(id, { infants: '2' });
        assert.equal(refused.body.ok, false);
        assert.match(refused.body.data, /only 0 spaces left|has only/);
        assert.equal((await edit(id, { infants: '' })).body.ok, true, 'a blank box means none');
        assert.equal((await t.findBooking(id)).infants, 0);
    });
    it('a restored booking needs room for its infants too', async () => {
        const id = await t.insertBooking({ date: t.day(10), adults: 1, infants: 2, status: 'cancelled' });
        await t.insertBooking({ date: t.day(10), adults: 10 });
        const res = await t.call(app, 'post', '/bookings/restore', { token, body: { _id: id } });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /only 2 spaces left/);
    });
});
