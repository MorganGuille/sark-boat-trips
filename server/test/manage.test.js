// Manage my booking (spec P2-6): the link in every customer email opens their booking, where they can
// cancel or add or remove people up to the free-cancellation deadline, and send the owner a message.
// Owner's decisions, 1 Nov 2026: a different day or time goes through the owner; after the deadline
// the page only shows how to get in touch; every change emails the owner; phone bookings too.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const Availability = require('../models/availability');
const { whatCanChange, freeUntil } = require('../utils/manage');
const { newManageToken } = require('../utils/bookingCodes');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let db, token;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const FREE = t.day(5); // the deadline (24 hours before) is days away
const SOON = t.day(1); // tomorrow: inside a charter's 48 hours

// A booking with its link, as every new booking has one. Returns the code in its link.
const insert = async (fields = {}) => {
    const code = newManageToken();
    const id = await t.insertBooking({ date: FREE, email: 'ann@example.test', firstName: 'Ann', adults: 2, paymentStatus: 'card_saved', prices: { adult: 4000, child: 2500, charter: 40000 }, manageToken: code, reference: 'SBT-ABC234', ...fields });
    return { code, id };
};
const open = (code) => t.call(app, 'get', `/bookings/manage/${code}`);
const cancel = (code) => t.call(app, 'post', `/bookings/manage/${code}/cancel`, { body: {} });
const party = (code, body) => t.call(app, 'post', `/bookings/manage/${code}/party`, { body });
const message = (code, text, ip) => t.call(app, 'post', `/bookings/manage/${code}/message`, { body: { message: text }, ip });

describe('every booking has a link and a reference', () => {
    it('an online booking: the confirmation email has the button and the reference', async () => {
        const { booking } = await t.bookOnline(app, t.booking({ date: FREE }));
        assert.match(booking.manageToken, /^[A-Za-z0-9_-]{32}$/);
        assert.match(booking.reference, /^SBT-[2-9A-HJKMNP-Z]{6}$/);
        const [mail] = mocks.sent(booking.email);
        assert.match(mail.text, new RegExp(`Manage your booking: http://localhost:5173/manage/${booking.manageToken}\\n`));
        assert.match(mail.text, new RegExp(`Booking reference: ${booking.reference}`));
        assert.match(mail.html, new RegExp(`href="http://localhost:5173/manage/${booking.manageToken}"`));
        assert.match(mocks.sent(t.OWNER)[0].text, new RegExp(`Reference: ${booking.reference}`));
    });
    it('a booking added on the dashboard (a phone booking) gets them too', async () => {
        await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: FREE, timeslot: '11am', firstName: 'Phil', email: 'phil@example.test', adults: '2' } });
        const saved = await db.collection('bookings').findOne({ firstName: 'Phil' });
        assert.match(saved.manageToken, /^[A-Za-z0-9_-]{32}$/);
        assert.match(mocks.sent('phil@example.test')[0].text, /Manage your booking: /);
    });
    it('an older booking without them gets them the first time it is emailed, and keeps them', async () => {
        const id = await t.insertBooking({ date: FREE, email: 'old@example.test', adults: 2 });
        await t.call(app, 'post', `/bookings/update/${id}`, { token, body: { adults: '3' } });
        const first = await t.findBooking(id);
        assert.match(first.manageToken, /^[A-Za-z0-9_-]{32}$/);
        assert.match(mocks.sent('old@example.test')[0].text, new RegExp(`/manage/${first.manageToken}`));
        await t.call(app, 'post', `/bookings/update/${id}`, { token, body: { adults: '2' } });
        assert.equal((await t.findBooking(id)).manageToken, first.manageToken, 'the link in the first email still works');
    });
    it('the owner can find a booking by its reference, with or without the SBT-', async () => {
        await insert();
        for (const search of ['SBT-ABC234', 'abc234']) {
            const res = await t.call(app, 'get', `/bookings/search/${search}`, { token });
            assert.deepEqual(res.body.data.map((b) => b.firstName), ['Ann'], search);
        }
    });
});

describe('opening the page', () => {
    it('shows the booking, what it costs and until when it can be changed, and nothing private', async () => {
        const { code } = await insert({ cardLabel: 'Visa •••• 4242 (expires 08/28)', stripeCustomerId: 'cus_secret', stripePaymentMethodId: 'pm_secret' });
        const res = await open(code);
        assert.equal(res.status, 200);
        const b = res.body.booking;
        assert.equal(b.reference, 'SBT-ABC234');
        assert.equal(b.day, t.long(FREE));
        assert.equal(b.time, '11am');
        assert.equal(b.party, '2 adults');
        assert.equal(b.amount, 8000);
        assert.equal(b.canChange, true);
        assert.equal(b.freeUntil, `11am on ${t.long(t.day(4))}`, '24 hours before the trip');
        assert.equal(b.maxSeats, 12, 'their own 2 seats plus the 10 left');
        assert.doesNotMatch(JSON.stringify(res.body), /cus_secret|pm_secret|manageToken|_id/);
    });
    it('a wrong or made-up link finds nothing', async () => {
        await insert();
        assert.equal((await open(newManageToken())).status, 404);
        assert.equal((await open('not-a-code')).status, 404);
        assert.equal((await cancel(newManageToken())).status, 404);
    });
});

describe('cancelling', () => {
    it('before the deadline: cancelled, the seats are free, and the customer and the owner are told', async () => {
        const { code, id } = await insert();
        const res = await cancel(code);
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /cancelled and your card won't be charged/);
        assert.equal(res.body.booking.cancelled, true);
        assert.equal((await t.findBooking(id)).status, 'cancelled');
        assert.equal((await t.seatsLeft(app, FREE))['11am'], 12);
        assert.match(mocks.sent('ann@example.test')[0].subject, /has been cancelled$/);
        assert.match(mocks.sent('ann@example.test')[0].text, /booking reference SBT-ABC234/);
        const [owner] = mocks.sent(t.OWNER);
        assert.match(owner.subject, /^Cancelled by customer: Ann Booking, 2 people/);
        assert.match(owner.text, /card saved, it will not be charged/);
        assert.equal((await cancel(code)).status, 409, 'only once');
    });
    it('after the deadline (a charter tomorrow): refused, nothing changes, nobody is emailed', async () => {
        const { code, id } = await insert({ date: SOON, charter: 'true' });
        const page = (await open(code)).body.booking;
        assert.equal(page.canChange, false);
        assert.match(page.why, /too late/);
        assert.equal(page.maxSeats, null);
        const res = await cancel(code);
        assert.equal(res.status, 409);
        assert.equal((await t.findBooking(id)).status, 'active');
        assert.equal(mocks.mails.length, 0);
    });
    it('the owner moved the trip to another time: free until it starts, as the terms say', async () => {
        const { code } = await insert({ date: SOON, charter: 'true' });
        await Availability.create({ date: SOON, timeslot: '11am', startTime: '12:00' });
        assert.equal((await open(code)).body.booking.freeUntil, `12pm on ${t.long(SOON)}`);
        assert.equal((await cancel(code)).body.ok, true);
    });
    it('a paid booking is never changed online', async () => {
        for (const paymentStatus of ['paid', 'paid_in_person', 'charging']) {
            const { code, id } = await insert({ paymentStatus });
            assert.match((await open(code)).body.booking.why, /contact us/, paymentStatus);
            assert.equal((await cancel(code)).status, 409, paymentStatus);
            assert.equal((await t.findBooking(id)).status, 'active');
        }
    });
    it('a booking without a payment status (made on the dashboard) can be cancelled', async () => {
        const { code } = await insert({ paymentStatus: undefined });
        assert.equal((await cancel(code)).body.ok, true);
    });
});

describe('changing the number of people', () => {
    it('fewer people: saved, the price drops, the customer gets the details and the owner is told', async () => {
        const { code, id } = await insert({ adults: 3, children: 1 });
        const res = await party(code, { adults: '2', children: '1', infants: '1' });
        assert.equal(res.body.ok, true);
        assert.equal(res.body.data, "Your booking is now for 2 adults, 1 child and 1 infant. We've emailed you the details.");
        assert.equal(res.body.booking.amount, 10500);
        const saved = await t.findBooking(id);
        assert.deepEqual([saved.adults, saved.children, saved.infants], [2, 1, 1]);
        const [mail] = mocks.sent('ann@example.test');
        assert.match(mail.subject, /^Your booking has changed/);
        assert.match(mail.text, /Payment: £105, charged to your saved card at 11am on the day/);
        const [owner] = mocks.sent(t.OWNER);
        assert.match(owner.subject, /^Party changed by customer: Ann Booking, now 4 people, 11am /);
        assert.match(owner.text, /was 3 adults and 1 child, now 2 adults, 1 child and 1 infant/);
    });
    it('more people, if there are seats; otherwise it says how many fit', async () => {
        await t.insertBooking({ date: FREE, adults: 8 });
        const { code, id } = await insert({ adults: 2 }); // 2 seats left
        assert.equal((await open(code)).body.booking.maxSeats, 4);
        assert.equal((await party(code, { adults: '4' })).body.ok, true);
        const refused = await party(code, { adults: '4', infants: '1' });
        assert.equal(refused.status, 409);
        assert.match(refused.body.data, /only room for 4 people on this trip now \(infants take a seat too\)/);
        assert.equal((await t.findBooking(id)).adults, 4);
        assert.equal((await t.findBooking(id)).infants, 0);
    });
    it('a charter has the boat: up to 12, whatever else', async () => {
        const { code } = await insert({ charter: 'true', adults: 4 });
        assert.equal((await open(code)).body.booking.maxSeats, 12);
        assert.equal((await party(code, { adults: '10', children: '2' })).body.ok, true);
        assert.match((await party(code, { adults: '10', children: '2', infants: '1' })).body.data, /up to 12 people/);
    });
    it('the numbers must make sense, and nothing changing is said so', async () => {
        const { code } = await insert();
        for (const body of [{ adults: '0' }, { adults: '13' }, { adults: '2', children: '-1' }, { adults: '2', infants: 'two' }, { adults: ['2'] }, {}]) {
            assert.equal((await party(code, body)).status, 400, JSON.stringify(body));
        }
        const same = await party(code, { adults: '2', children: '0' });
        assert.equal(same.body.data, 'Nothing has changed.');
        assert.equal(mocks.mails.length, 0);
    });
    it('after the deadline, or paid: refused', async () => {
        const late = await insert({ date: SOON, charter: 'true' });
        assert.equal((await party(late.code, { adults: '3' })).status, 409);
        const paid = await insert({ paymentStatus: 'paid' });
        assert.equal((await party(paid.code, { adults: '3' })).status, 409);
    });
    it('two people adding to their bookings at the same moment can\'t both take the last seats', async () => {
        await t.insertBooking({ date: FREE, adults: 8 });
        const one = await insert({ adults: 1, email: 'one@example.test' });
        const two = await insert({ adults: 1, email: 'two@example.test' }); // 2 seats left
        await Promise.all([party(one.code, { adults: '3' }), party(two.code, { adults: '3' })]);
        assert.equal((await t.seatsLeft(app, FREE))['11am'], 0, 'full, but never over');
    });
    it('a failed email never undoes the change', async () => {
        const { code, id } = await insert();
        mocks.mailMode = 'all';
        const res = await party(code, { adults: '1' });
        assert.equal(res.body.ok, true);
        assert.equal(res.body.data, 'Your booking is now for 1 adult.');
        assert.equal((await t.findBooking(id)).adults, 1);
    });
});

describe('sending the owner a message', () => {
    it('is emailed to the owner, who can reply straight to the customer; what they typed is escaped', async () => {
        const { code } = await insert();
        const res = await message(code, 'Could we move to the 2pm?\n<b>Thanks</b>');
        assert.equal(res.body.ok, true);
        const [mail] = mocks.sent(t.OWNER);
        assert.match(mail.subject, /^Message from Ann Booking: 2 people, 11am /);
        assert.equal(mail.replyTo, 'ann@example.test');
        assert.match(mail.text, /Could we move to the 2pm\?/);
        assert.match(mail.html, /&lt;b&gt;Thanks&lt;\/b&gt;/);
        assert.doesNotMatch(mail.html, /<b>Thanks/);
        assert.match(mail.text, /Reference: SBT-ABC234/);
    });
    it('works after the deadline too, and must have something in it', async () => {
        const { code } = await insert({ date: SOON, charter: 'true' });
        assert.equal((await message(code, 'Running late!')).body.ok, true);
        assert.equal((await message(code, '   ')).status, 400);
        assert.equal((await message(code, 'x'.repeat(1001))).status, 400);
    });
    it('says so if it could not be sent', async () => {
        const { code } = await insert();
        mocks.mailMode = 'admin';
        const res = await message(code, 'Hello');
        assert.equal(res.status, 502);
        assert.match(res.body.data, /couldn't be sent/);
    });
    it('a few messages per booking per hour, from wherever they come', async () => {
        const { code } = await insert();
        for (let i = 0; i < 5; i++) assert.equal((await message(code, `Message ${i}`)).status, 200);
        assert.equal((await message(code, 'One more')).status, 429);
    });
});

describe('the rules (fixed clock)', () => {
    const trip = { startsAt: new Date('2033-06-15T10:00:00Z'), timeChanged: false };
    const booking = { status: 'active', paymentStatus: 'card_saved', charter: 'false' };
    it('a trip: free until 24 hours before; a charter: 48', () => {
        assert.deepEqual(freeUntil(booking, trip), new Date('2033-06-14T10:00:00Z'));
        assert.deepEqual(freeUntil({ ...booking, charter: 'true' }, trip), new Date('2033-06-13T10:00:00Z'));
        assert.equal(whatCanChange(booking, trip, new Date('2033-06-14T09:59:00Z')).canChange, true);
        assert.equal(whatCanChange(booking, trip, new Date('2033-06-14T10:00:00Z')).why, 'deadline');
        assert.equal(whatCanChange(booking, { ...trip, timeChanged: true }, new Date('2033-06-15T09:59:00Z')).canChange, true);
        assert.equal(whatCanChange(booking, { ...trip, timeChanged: true }, new Date('2033-06-15T10:00:00Z')).why, 'started');
    });
});
