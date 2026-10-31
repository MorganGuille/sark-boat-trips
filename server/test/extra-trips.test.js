// Extra trips (spec P2-2 step 3): the owner adds a trip to one day (a swim trip, a sunset trip) with
// its own name, note, time, harbour, seats, length and adult and child prices. Customers book it online
// by the seat (never as a charter), it is charged at its own price and time, and everything else
// (emails, calendar file, dashboard, report, the other trip tools) follows it.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { runDueCharges } = require('../utils/charges');
const { tripStartsAt } = require('../utils/validateBooking');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token;
before(async () => { await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const DAY = t.day(10);
const SWIM = { date: DAY, name: 'Swim trip', note: 'Bring swimwear and a towel.', startTime: '16:30', harbour: 'creux', hours: '1.5', capacity: '8', adultPrice: '45', childPrice: '30' };
const post = (path, body, { auth = true } = {}) => t.call(app, 'post', path, { token: auth ? token : undefined, body });
const addTrip = (body = {}, options) => post('/bookings/add-trip', { ...SWIM, ...body }, options);
const dayTrips = (date = DAY) => t.call(app, 'get', `/bookings/trips/${date}`);
// Adds the swim trip and returns it as the booking page sees it
const addSwim = async (body) => {
    const res = await addTrip(body);
    assert.equal(res.body.ok, true, res.body.data);
    return (await dayTrips(body?.date || DAY)).body.data.find((trip) => trip.extra);
};
const ics = (mail) => (mail.attachments.find((a) => a.filename.endsWith('.ics'))?.content || '').replace(/\r\n /g, '');

describe('adding an extra trip', () => {
    it('is for the owner only', async () => {
        assert.equal((await addTrip({}, { auth: false })).status, 401);
    });

    for (const [name, body, message] of [
        ['no name', { name: '  ' }, /give the trip a name/],
        ['a name that is far too long', { name: 'x'.repeat(41) }, /up to 40/],
        ['a note that is far too long', { note: 'x'.repeat(301) }, /up to 300/],
        ['a time that is not a time', { startTime: '4.30pm' }, /between 7am and 8pm/],
        ['too late in the evening', { startTime: '21:00' }, /between 7am and 8pm/],
        ['a harbour we do not use', { harbour: 'havre gosselin' }, /choose a harbour/],
        ['no length', { hours: '' }, /length in hours/],
        ['a length that is far too long', { hours: '12' }, /length in hours/],
        ['a length that is not in quarter hours', { hours: '1.3' }, /length in hours/],
        ['no seats', { capacity: '0' }, /number of seats/],
        ['half a seat', { capacity: '7.5' }, /number of seats/],
        ['more seats than the boat can legally take', { capacity: '13' }, /from 1 to 12/],
        ['a price that is not a price', { adultPrice: 'forty' }, /adult and child prices/],
        ['no child price', { childPrice: '' }, /adult and child prices/],
        ['a list instead of a name', { name: ['Swim trip'] }, /give the trip a name/],
        ['a date that is not a date', { date: '10-11-2030' }, /valid date/],
    ]) {
        it(`refuses ${name}`, async () => {
            const res = await addTrip(body);
            assert.equal(res.status, 400);
            assert.match(res.body.data, message);
            assert.equal((await dayTrips()).body.data.length, 2, 'nothing added');
        });
    }

    it('refuses a time that has already passed', async () => {
        const res = await addTrip({ date: t.day(-1) });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /already passed/);
    });

    it('shows on that day only, in time order, with its name, note and prices for the booking page', async () => {
        const res = await addTrip({ startTime: '12:30' });
        assert.equal(res.body.ok, true);
        assert.equal(res.body.data, `Swim trip added on ${t.shown(DAY)} at 12:30pm from the Creux Harbour: 8 seats, 1.5 hours, £45 adults, £30 children. Customers can book it now. It overlaps the 11am trip.`);
        const trips = (await dayTrips()).body.data;
        assert.deepEqual(trips.map((trip) => trip.label), ['11am', 'Swim trip (12:30pm)', '2pm']);
        const swim = trips[1];
        assert.match(swim.timeslot, /^x[0-9a-f]{6}$/);
        assert.deepEqual([swim.extra, swim.name, swim.note, swim.time, swim.hours, swim.prices], [true, 'Swim trip', 'Bring swimwear and a towel.', '12:30pm', 1.5, { adult: '45', child: '30' }]);
        assert.equal((await dayTrips(t.day(11))).body.data.length, 2, 'the next day is untouched');
    });

    it('the calendar counts its seats (its own number, not 12)', async () => {
        const swim = await addSwim();
        assert.deepEqual((await t.seatsLeft(app, DAY)).extras, [{ timeslot: swim.timeslot, spaces: 8 }]);
        assert.equal((await t.seatsLeft(app, t.day(11))).extras, undefined, 'a day without extra trips is as before');
    });
});

describe('a customer booking an extra trip online', () => {
    it('pays its own price, which the booking keeps', async () => {
        const swim = await addSwim();
        const { booking } = await t.bookOnline(app, t.booking({ date: DAY, timeslot: swim.timeslot, adults: '2', children: '1', email: 'sam@example.test' }));
        assert.ok(booking);
        assert.deepEqual(booking.prices, { adult: 4500, child: 3000, charter: 40000 });
        assert.match(mocks.stripe.created[0].custom_text.submit.message, /£120 will be charged at 4:30pm on .*, when your Swim trip starts\./);
    });

    it('is limited to its own seats', async () => {
        const swim = await addSwim();
        assert.ok((await t.bookOnline(app, t.booking({ date: DAY, timeslot: swim.timeslot, adults: '6' }))).booking);
        const { res, booking } = await t.bookOnline(app, t.booking({ date: DAY, timeslot: swim.timeslot, adults: '3' }));
        assert.equal(booking, null);
        assert.equal(res.body.data, `Sorry, there are only 2 spaces left on the Swim trip (4:30pm) on ${t.shown(DAY)}, and you asked for 3. Please book fewer people or choose another trip.`);
        assert.deepEqual((await t.seatsLeft(app, DAY)).extras.map((x) => x.spaces), [2]);
        assert.equal((await t.seatsLeft(app, DAY))['11am'], 12, 'the usual trips are untouched');
    });

    it('the owner adding too many on the dashboard is told how many seats are left', async () => {
        const swim = await addSwim();
        const res = await t.call(app, 'post', '/bookings/admin-add', { token, body: { date: DAY, timeslot: swim.timeslot, firstName: 'Big', adults: '10' } });
        assert.equal(res.body.ok, false);
        assert.equal(res.body.data, `Only 8 spaces left on the Swim trip (4:30pm) on ${t.shown(DAY)}, and this booking is for 10. Raise the trip's seats first if you want to fit them in.`);
    });

    it('can\'t book it as a private charter', async () => {
        const swim = await addSwim();
        const { res, booking } = await t.bookOnline(app, t.booking({ date: DAY, timeslot: swim.timeslot }), { kind: 'charter' });
        assert.equal(booking, null);
        assert.equal(res.status, 400);
        assert.match(res.body.data, /can't be booked as a private charter/);
    });

    it('can\'t book a trip that isn\'t running that day', async () => {
        const swim = await addSwim();
        const { res } = await t.bookOnline(app, t.booking({ date: t.day(11), timeslot: swim.timeslot }));
        assert.equal(res.status, 400);
        assert.match(res.body.data, /no longer running/);
    });

    it('the confirmation names the trip, gives its note, and its calendar entry lasts as long as the trip', async () => {
        const swim = await addSwim();
        await t.bookOnline(app, t.booking({ date: DAY, timeslot: swim.timeslot, email: 'sam@example.test' }));
        const mail = mocks.sent('sam@example.test')[0];
        assert.equal(mail.subject, `Your Swim trip on ${t.short(DAY)} at 4:30pm is confirmed`);
        assert.match(mail.text, /Trip: Swim trip\nDate: .*\nTime: 4:30pm/);
        assert.match(mail.text, /Bring swimwear and a towel\./);
        assert.match(mail.text, /Payment: £90, charged to your saved card at 4:30pm on the day/);
        const file = ics(mail);
        const start = tripStartsAt(DAY, swim.timeslot, '16:30');
        const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        assert.match(file, new RegExp(`DTSTART:${stamp(start)}\r\nDTEND:${stamp(new Date(start.getTime() + 90 * 60000))}`));
        assert.match(file, /SUMMARY:Sark Boat Trips: Swim trip \(2 adults\)/);
        assert.match(mocks.sent(t.OWNER)[0].text, /Trip: Swim trip\nWhen: .* at 4:30pm/);
    });

    it('a trip deleted while the customer was entering their card is not booked, and nothing is charged', async () => {
        const swim = await addSwim();
        const res = await t.call(app, 'post', '/bookings/checkout', { body: t.booking({ date: DAY, timeslot: swim.timeslot }) });
        assert.ok(res.body.url);
        assert.equal((await post('/bookings/remove-trip', { date: DAY, timeslot: swim.timeslot })).body.ok, true);
        const params = mocks.stripe.created.at(-1);
        const id = res.body.url.split('/').pop();
        const session = { id, object: 'checkout.session', mode: 'setup', status: 'complete', customer: params.customer, setup_intent: `seti_${id}`, metadata: params.metadata };
        mocks.stripe.sessions[id] = session;
        await t.webhook(app, session);
        const booking = await require('mongoose').connection.db.collection('bookings').findOne({ stripeSessionId: id });
        assert.equal(booking.status, 'cancelled');
    });
});

describe('the card charge', () => {
    it('is taken at the extra trip\'s time, at its price', async () => {
        const swim = await addSwim();
        const { booking } = await t.bookOnline(app, t.booking({ date: DAY, timeslot: swim.timeslot, adults: '2' }));
        await runDueCharges(new Date(tripStartsAt(DAY, '2pm').getTime() + 60000));
        assert.equal((await t.findBooking(booking._id.toString())).paymentStatus, 'card_saved', 'not at 2pm');
        await runDueCharges(new Date(tripStartsAt(DAY, swim.timeslot, '16:30').getTime() + 60000));
        const charged = await t.findBooking(booking._id.toString());
        assert.equal(charged.paymentStatus, 'paid');
        assert.equal(charged.amountPaid, 9000);
    });
});

describe('extra trips on the dashboard', () => {
    it('a booking added by the owner gets the trip\'s prices, and the day view names the trip', async () => {
        const swim = await addSwim();
        const res = await post('/bookings/admin-add', { date: DAY, timeslot: swim.timeslot, firstName: 'Ann', adults: '2' });
        assert.equal(res.body.data, `Booking for Ann on ${t.shown(DAY)} at Swim trip (4:30pm) saved (no email address, so no confirmation was sent)`);
        const day = (await t.call(app, 'get', `/bookings/${DAY}`, { token })).body.data;
        assert.deepEqual([day[0].tripLabel, day[0].amountDue], ['Swim trip (4:30pm)', 9000]);
    });

    it('the owner can\'t make it a charter either', async () => {
        const swim = await addSwim();
        const res = await post('/bookings/admin-add', { date: DAY, timeslot: swim.timeslot, firstName: 'Ann', charter: 'true' });
        assert.equal(res.status, 400);
        assert.match(res.body.data, /can't be booked as a private charter/);
    });

    it('moving a booking onto it charges the trip\'s price, and moving it back the normal price', async () => {
        const swim = await addSwim();
        const id = await t.insertBooking({ date: DAY, timeslot: '11am', prices: { adult: 3500, child: 2000, charter: 40000 } });
        assert.equal((await post(`/bookings/update/${id}`, { timeslot: swim.timeslot })).body.ok, true);
        assert.deepEqual((await t.findBooking(id)).prices, { adult: 4500, child: 3000, charter: 40000 });
        assert.equal((await post(`/bookings/update/${id}`, { timeslot: '2pm' })).body.ok, true);
        assert.deepEqual((await t.findBooking(id)).prices, { adult: 4000, child: 2500, charter: 40000 }, "today's normal prices");
    });

    it('moving between the usual trips keeps the price it was booked at', async () => {
        const id = await t.insertBooking({ date: DAY, timeslot: '11am', prices: { adult: 3500, child: 2000, charter: 40000 } });
        assert.equal((await post(`/bookings/update/${id}`, { timeslot: '2pm' })).body.ok, true);
        assert.deepEqual((await t.findBooking(id)).prices, { adult: 3500, child: 2000, charter: 40000 });
    });

    it('a booking can\'t be moved to another day with an extra trip that only runs on the first day', async () => {
        const swim = await addSwim();
        const id = await t.insertBooking({ date: DAY, timeslot: swim.timeslot });
        const res = await post(`/bookings/update/${id}`, { date: t.day(11) });
        assert.equal(res.status, 400);
        assert.match(res.body.data, /not running/);
        assert.equal((await t.findBooking(id)).date, DAY);
    });

    it('moving it, messaging it and cancelling it work as for the usual trips', async () => {
        const swim = await addSwim();
        await t.insertBooking({ date: DAY, timeslot: swim.timeslot, firstName: 'Ann', email: 'ann@example.test' });

        const moved = await post('/bookings/change-trip', { date: DAY, timeslot: swim.timeslot, startTime: '17:00', harbour: 'maseline', notifyCustomers: true });
        assert.match(moved.body.data, /^The Swim trip \(4:30pm\) on .* now leaves at 5pm from the Maseline Harbour\. 1 customer emailed\./);
        const after = (await dayTrips()).body.data.find((trip) => trip.extra);
        assert.deepEqual([after.time, after.timeChanged, after.harbour, after.name], ['5pm', false, 'Maseline Harbour', 'Swim trip'], 'an extra trip has no usual time to cross out');
        assert.equal(mocks.sent('ann@example.test')[0].subject, `Your Swim trip on ${t.short(DAY)} has moved to 5pm, from the Maseline Harbour`);

        const messaged = await post('/bookings/message-trip', { date: DAY, timeslot: swim.timeslot, message: 'Water is lovely!' });
        assert.match(messaged.body.data, /^Message sent to 1 customer on the Swim trip \(5pm\) on/);

        const cancelled = await post('/bookings/cancel-trip', { date: DAY, timeslot: swim.timeslot, reason: 'weather' });
        assert.match(cancelled.body.data, /^The Swim trip \(5pm\) on .* is cancelled and closed to new bookings: 1 booking cancelled/);
        assert.match(mocks.sent(t.OWNER).at(-1).text, /You cancelled the Swim trip \(5pm\) on /);
    });
});

describe('editing an extra trip', () => {
    const edit = (swim, body = {}, options) => post('/bookings/edit-trip', { ...SWIM, timeslot: swim.timeslot, ...body }, options);

    it('is for the owner only, and only for extra trips', async () => {
        const swim = await addSwim();
        assert.equal((await edit(swim, {}, { auth: false })).status, 401);
        assert.match((await edit({ timeslot: '11am' })).body.data, /Only an extra trip/);
    });

    it('checks the details the same way as adding', async () => {
        const swim = await addSwim();
        const res = await edit(swim, { capacity: '0' });
        assert.equal(res.status, 400);
        assert.match(res.body.data, /number of seats/);
        const tooMany = await edit(swim, { capacity: '13' });
        assert.equal(tooMany.status, 400);
        assert.match(tooMany.body.data, /from 1 to 12/);
    });

    it('says so when nothing changed', async () => {
        const swim = await addSwim();
        assert.equal((await edit(swim)).body.data, 'Nothing to change.');
    });

    it('fixing the name, note, length and seats saves them and emails nobody', async () => {
        const swim = await addSwim();
        await t.insertBooking({ date: DAY, timeslot: swim.timeslot, email: 'ann@example.test' });
        mocks.reset();
        const res = await edit(swim, { name: 'Swimming trip', note: '', hours: '2', capacity: '10' });
        assert.equal(res.body.data, `Swimming trip (4:30pm) on ${t.shown(DAY)} saved.`);
        const after = (await dayTrips()).body.data.find((trip) => trip.extra);
        assert.deepEqual([after.timeslot, after.name, after.note, after.hours, after.capacity], [swim.timeslot, 'Swimming trip', '', 2, 10]);
        assert.equal((await t.seatsLeft(app, DAY)).extras[0].spaces, 8);
        assert.equal(mocks.mails.length, 0);
    });

    it('a new price applies to everyone on it who hasn\'t paid yet', async () => {
        const swim = await addSwim();
        const old = { adult: 4500, child: 3000, charter: 40000 };
        const unpaid = await t.insertBooking({ date: DAY, timeslot: swim.timeslot, prices: old });
        const card = await t.insertBooking({ date: DAY, timeslot: swim.timeslot, prices: old, paymentStatus: 'card_saved' });
        const paid = await t.insertBooking({ date: DAY, timeslot: swim.timeslot, prices: old, paymentStatus: 'paid', amountPaid: 9000 });
        const res = await edit(swim, { adultPrice: '50', childPrice: '32.50' });
        assert.equal(res.body.data, `Swim trip (4:30pm) on ${t.shown(DAY)} saved. 2 bookings on it now pay the new price.`);
        const now = { adult: 5000, child: 3250, charter: 40000 };
        assert.deepEqual((await t.findBooking(unpaid)).prices, now);
        assert.deepEqual((await t.findBooking(card)).prices, now);
        assert.deepEqual((await t.findBooking(paid)).prices, old, 'already paid: left alone');
        assert.deepEqual((await dayTrips()).body.data.find((trip) => trip.extra).prices, { adult: '50', child: '32.50' });
    });

    it('fewer seats than are booked is allowed, with a warning', async () => {
        const swim = await addSwim();
        await t.insertBooking({ date: DAY, timeslot: swim.timeslot, adults: 6 });
        const res = await edit(swim, { capacity: '4' });
        assert.match(res.body.data, /6 seats are already booked, more than the 4 you set, so nobody else can book it\.$/);
    });

    it('a new time or harbour emails everyone on it, like Change trip details', async () => {
        const swim = await addSwim();
        await t.insertBooking({ date: DAY, timeslot: swim.timeslot, firstName: 'Ann', email: 'ann@example.test' });
        mocks.reset();
        const res = await edit(swim, { startTime: '17:00', harbour: 'maseline' });
        assert.match(res.body.data, /saved\. It now leaves at 5pm from the Maseline Harbour\. 1 customer emailed\.$/);
        assert.equal(mocks.sent('ann@example.test')[0].subject, `Your Swim trip on ${t.short(DAY)} has moved to 5pm, from the Maseline Harbour`);
        assert.match(mocks.sent(t.OWNER)[0].subject, /^Trip changed: the Swim trip \(4:30pm\) on /);
    });

    it('with "don\'t email customers", a move only sends the owner\'s summary', async () => {
        const swim = await addSwim();
        await t.insertBooking({ date: DAY, timeslot: swim.timeslot, email: 'ann@example.test' });
        mocks.reset();
        const res = await edit(swim, { startTime: '17:00', notifyCustomers: false });
        assert.match(res.body.data, /1 booking on it, not emailed \(as you chose\)\.$/);
        assert.equal(mocks.sent('ann@example.test').length, 0);
    });

    it('a trip that has started can\'t move, but its name can still be fixed', async () => {
        const Availability = require('../models/availability');
        const past = t.day(-1);
        await Availability.create({ date: past, timeslot: 'xabc123', extra: true, name: 'Swim trp', startTime: '16:30', hours: 1.5, capacity: 8, prices: { adult: 4500, child: 3000 } });
        const body = { ...SWIM, date: past, timeslot: 'xabc123' };
        assert.match((await post('/bookings/edit-trip', { ...body, startTime: '17:00' })).body.data, /has already started/);
        assert.equal((await post('/bookings/edit-trip', body)).body.ok, true);
        assert.equal((await Availability.findOne({ timeslot: 'xabc123' })).name, 'Swim trip');
    });
});

describe('deleting an extra trip', () => {
    it('is refused while anyone is booked on it', async () => {
        const swim = await addSwim();
        await t.insertBooking({ date: DAY, timeslot: swim.timeslot });
        const res = await post('/bookings/remove-trip', { date: DAY, timeslot: swim.timeslot });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /has 1 booking\. Cancel the trip first/);
        assert.equal((await dayTrips()).body.data.length, 3);
    });

    it('with no bookings, removes it completely', async () => {
        const swim = await addSwim();
        const res = await post('/bookings/remove-trip', { date: DAY, timeslot: swim.timeslot });
        assert.equal(res.body.data, `Swim trip (4:30pm) on ${t.shown(DAY)} deleted. Customers can no longer see it.`);
        assert.equal((await dayTrips()).body.data.length, 2);
        assert.equal(await require('../models/availability').countDocuments({}), 0);
    });

    it('after cancelling it, hides it but its cancelled bookings still say which trip they were (and can\'t be restored)', async () => {
        const swim = await addSwim();
        const id = await t.insertBooking({ date: DAY, timeslot: swim.timeslot });
        await post('/bookings/cancel-trip', { date: DAY, timeslot: swim.timeslot, reason: 'weather' });
        assert.equal((await post('/bookings/remove-trip', { date: DAY, timeslot: swim.timeslot })).body.ok, true);
        assert.equal((await dayTrips()).body.data.length, 2, 'customers no longer see it');
        assert.equal((await t.seatsLeft(app, DAY)).extras, undefined);
        const day = (await t.call(app, 'get', `/bookings/${DAY}?includeCancelled=true`, { token })).body.data;
        assert.equal(day[0].tripLabel, 'Swim trip (4:30pm)');
        const restore = await post('/bookings/restore', { _id: id });
        assert.equal(restore.body.ok, false);
        assert.match(restore.body.data, /\(Swim trip \(4:30pm\)\) no longer runs/);
    });

    it('only works on extra trips, and only for the owner', async () => {
        assert.match((await post('/bookings/remove-trip', { date: DAY, timeslot: '11am' })).body.data, /Only an extra trip/);
        assert.equal((await post('/bookings/remove-trip', { date: DAY, timeslot: '11am' }, { auth: false })).status, 401);
    });
});

describe('the monthly report', () => {
    it('counts an extra trip at its own price', async () => {
        const swim = await addSwim();
        await post('/bookings/admin-add', { date: DAY, timeslot: swim.timeslot, firstName: 'Ann', adults: '2', children: '1' });
        await post('/bookings/admin-add', { date: DAY, timeslot: '11am', firstName: 'Bob', adults: '1' });
        const report = (await t.call(app, 'get', `/bookings/report/${DAY.slice(0, 7)}`, { token })).body;
        assert.equal(report.total.income, 12000 + 4000);
    });
});
