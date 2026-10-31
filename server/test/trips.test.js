// Moving one trip to another time and/or harbour for a day (spec P2-2), and everything that follows it:
// the emails, the card charge, the booking cutoff, the reminder, the calendar file and Stripe's page.
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { runDueCharges } = require('../utils/charges');
const { runDueReminders } = require('../utils/reminders');
const { tripStartsAt, validatePublicBooking } = require('../utils/validateBooking');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let token, db;
before(async () => { db = await t.startDb(); token = await t.login(app); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); });

const DAY = t.day(10);
const change = (body, { auth = true } = {}) => t.call(app, 'post', '/bookings/change-trip', { token: auth ? token : undefined, body: { date: DAY, timeslot: '2pm', startTime: '15:00', harbour: 'creux', ...body } });
const dayTrips = (date = DAY) => t.call(app, 'get', `/bookings/trips/${date}`);
const ics = (mail) => mail.attachments.find((a) => a.filename.endsWith('.ics'))?.content || '';
const unfold = (text) => text.replace(/\r\n /g, '');
const card = (fields) => t.insertBooking({ date: DAY, timeslot: '2pm', paymentStatus: 'card_saved', stripeCustomerId: 'cus_1', stripePaymentMethodId: `pm_${Math.random()}`, prices: { adult: 4000, child: 2500, charter: 40000 }, ...fields });
const toCustomers = () => mocks.sent().filter((m) => m.to !== t.OWNER);

describe("the day's trips", () => {
    it('are the usual 11am and 2pm from the Creux Harbour, for anyone to see (the booking page asks)', async () => {
        const res = await dayTrips();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.map((trip) => [trip.timeslot, trip.time, trip.harbour, trip.timeChanged, trip.harbourChanged]), [
            ['11am', '11am', 'Creux Harbour', false, false],
            ['2pm', '2pm', 'Creux Harbour', false, false],
        ]);
    });

    it('show a changed trip as it is that day, and only that day', async () => {
        assert.equal((await change({ startTime: '15:30', harbour: 'maseline' })).body.ok, true);
        const trip = (await dayTrips()).body.data[1];
        assert.deepEqual([trip.timeslot, trip.time, trip.startTime, trip.harbour, trip.timeChanged, trip.harbourChanged], ['2pm', '3:30pm', '15:30', 'Maseline Harbour', true, true]);
        assert.equal((await dayTrips(t.day(11))).body.data[1].time, '2pm', 'the next day is untouched');
    });

    it('refuse a date that is not a date', async () => {
        assert.equal((await dayTrips('31-12-2030')).status, 400);
    });
});

describe('changing a trip', () => {
    it('is for the owner only', async () => {
        assert.equal((await change({}, { auth: false })).status, 401);
    });

    for (const [name, body, message] of [
        ['a time that is not a time', { startTime: '3pm' }, /between 7am and 8pm/],
        ['too early', { startTime: '06:30' }, /between 7am and 8pm/],
        ['too late', { startTime: '20:30' }, /between 7am and 8pm/],
        ['a harbour we do not use', { harbour: 'havre gosselin' }, /choose a harbour/],
        ['a trip that does not exist', { timeslot: '5pm' }, /which trip/],
        ['a note that is far too long', { note: 'x'.repeat(501) }, /up to 500/],
        ['a list instead of a time', { startTime: ['15:00'] }, /between 7am and 8pm/],
    ]) {
        it(`refuses ${name}`, async () => {
            const res = await change(body);
            assert.equal(res.status, 400);
            assert.match(res.body.data, message);
        });
    }

    it('refuses a change that changes nothing', async () => {
        const res = await change({ startTime: '14:00', harbour: 'creux' });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /Nothing to change/);
        assert.equal(mocks.mails.length, 0);
    });

    it('refuses a trip that has already started (its cards may have been charged)', async () => {
        const res = await change({ date: t.day(-1) });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /already started/);
    });

    it('keeps the trip\'s seats, and going back to the usual time and harbour removes the change', async () => {
        await t.call(app, 'post', '/bookings/updateavailability', { token, body: { date: DAY, timeslot: '2pm', capacity: '8' } });
        await change({ startTime: '16:00', harbour: 'maseline' });
        let row = await db.collection('availabilities').findOne({ date: DAY, timeslot: '2pm' });
        assert.deepEqual([row.capacity, row.startTime, row.harbour], [8, '16:00', 'maseline']);
        await change({ startTime: '14:00', harbour: 'creux' });
        row = await db.collection('availabilities').findOne({ date: DAY, timeslot: '2pm' });
        assert.deepEqual([row.capacity, row.startTime, row.harbour], [8, undefined, undefined]);
        assert.equal((await t.seatsLeft(app, DAY))['2pm'], 8);
    });

    it('warns, but allows it, when the trip now runs into the other one', async () => {
        const res = await change({ timeslot: '11am', startTime: '13:00' });
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /It now overlaps the 2pm trip \(trips last 2\.5 hours\)\./);
        assert.match(mocks.sent(t.OWNER)[0].text, /It now overlaps the 2pm trip/);
    });
});

describe('the emails when a trip moves', () => {
    it('everyone on it gets the new time, the owner\'s note, the new details and a calendar file', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test' });
        await card({ firstName: 'Bob', email: 'bob@example.test', charter: 'false' });
        await card({ firstName: 'Gone', email: 'gone@example.test', status: 'cancelled' });
        await t.insertBooking({ date: DAY, timeslot: '11am', firstName: 'Morning', email: 'morning@example.test' });
        const res = await change({ startTime: '15:00', note: 'Because of the tide, sorry for the change & thank you!' });
        assert.match(res.body.data, /The 2pm trip on .* now leaves at 3pm from the Creux Harbour\. 2 customers emailed\./);

        assert.deepEqual(toCustomers().map((m) => m.to).sort(), ['ann@example.test', 'bob@example.test'], 'not the cancelled booking, not the other trip');
        const mail = mocks.sent('ann@example.test')[0];
        assert.equal(mail.subject, `Your boat trip on ${t.short(DAY)} has moved to 3pm`);
        assert.match(mail.text, /^Your trip time has changed/);
        assert.match(mail.text, new RegExp(`Your boat trip on ${t.long(DAY)} now starts at 3pm \\(instead of 2pm\\)\\.`));
        assert.match(mail.text, /Because of the tide, sorry for the change & thank you!/);
        assert.ok(mail.html.includes('sorry for the change &amp; thank you!'), 'the note is escaped in the HTML');
        assert.match(mail.text, /Time: 3pm\n/);
        assert.match(mail.text, /If you can't make the new time, let us know and we'll cancel your booking free of charge\./);
        assert.match(unfold(ics(mail)), /DTSTART:\d{8}T1[45]0000Z/, 'the calendar entry moves to 3pm (14:00 or 15:00 UTC)');
    });

    it('a harbour move says so, with the right map link and calendar location', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test' });
        await change({ startTime: '14:00', harbour: 'maseline' });
        const mail = mocks.sent('ann@example.test')[0];
        assert.equal(mail.subject, `Your boat trip on ${t.short(DAY)} at 2pm now leaves from the Maseline Harbour`);
        assert.match(mail.text, /leaves from the Maseline Harbour \(instead of the Creux Harbour\)\./);
        assert.match(mail.text, /Meeting point: Maseline Harbour, Sark \(https:\/\/maps\.app\.goo\.gl\/nLfAgzx3fiaw66z88\)/);
        assert.match(mail.text, /Please be at the Maseline Harbour shortly before 2pm\./);
        assert.doesNotMatch(mail.text, /cancel your booking free of charge/, 'only a time change offers that');
        assert.match(unfold(ics(mail)), /LOCATION:Maseline Harbour\\, Sark/);
    });

    it('time and harbour together are one email', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test' });
        await change({ startTime: '16:15', harbour: 'maseline' });
        const [mail] = mocks.sent('ann@example.test');
        assert.equal(mail.subject, `Your boat trip on ${t.short(DAY)} has moved to 4:15pm, from the Maseline Harbour`);
        assert.match(mail.text, /now starts at 4:15pm \(instead of 2pm\) and leaves from the Maseline Harbour \(instead of the Creux Harbour\)\./);
    });

    it('the owner gets one summary: the change, the note, who is on it, and who could not be emailed', async () => {
        await card({ firstName: 'Ann', lastName: 'Smith', email: 'ann@example.test', phone: '0711' });
        await card({ firstName: 'NoMail', email: '' });
        await card({ firstName: 'Bounce', email: 'bounce@example.test' });
        mocks.failTo.add('bounce@example.test');
        const res = await change({ startTime: '15:00', note: 'Tide' });
        assert.match(res.body.data, /1 customer emailed, 2 not emailed \(see your email\)\./);
        const owner = mocks.sent(t.OWNER);
        assert.equal(owner.length, 1);
        assert.equal(owner[0].subject, `Trip changed: the 2pm on ${t.short(DAY)} is now 3pm (3 bookings)`);
        assert.match(owner[0].text, /Your note to customers: "Tide"/);
        assert.match(owner[0].text, /Ann Smith, 2 adults, phone 0711/);
        assert.match(owner[0].text, /NOT EMAILED[\s\S]*NoMail[\s\S]*Bounce/);
        assert.match(owner[0].text, /Open the dashboard: /);
    });

    it('with "don\'t email customers" (already phoned), only the owner\'s summary is sent', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test' });
        const res = await change({ startTime: '15:00', notifyCustomers: false });
        assert.match(res.body.data, /1 booking on it, not emailed \(as you chose\)\./);
        assert.equal(toCustomers().length, 0);
        assert.match(mocks.sent(t.OWNER)[0].text, /You chose not to email them\./);
    });
});

describe('everything follows the trip\'s new time and harbour', () => {
    it('the card is charged at the new time, not the old one', async () => {
        const id = await card({ firstName: 'Ann', email: 'ann@example.test' });
        await change({ startTime: '17:00' });
        await runDueCharges(new Date(tripStartsAt(DAY, '2pm').getTime() + 60000));
        assert.equal((await t.findBooking(id)).paymentStatus, 'card_saved', 'not at 2pm');
        await runDueCharges(new Date(tripStartsAt(DAY, '2pm', '17:00').getTime() + 60000));
        assert.equal((await t.findBooking(id)).paymentStatus, 'paid', 'at 5pm');
    });

    it('online booking closes an hour before the new time', async () => {
        await change({ startTime: '17:00' });
        const body = t.booking({ date: DAY, timeslot: '2pm' });
        assert.equal(await validatePublicBooking(body, new Date(tripStartsAt(DAY, '2pm', '15:30').getTime())), null, 'open at 3:30pm for a 5pm trip');
        assert.match(await validatePublicBooking(body, new Date(tripStartsAt(DAY, '2pm', '16:30').getTime())), /closed/);
    });

    it('someone booking afterwards is told the new time and harbour, on Stripe\'s page and in the confirmation', async () => {
        await change({ startTime: '15:00', harbour: 'maseline' });
        mocks.reset();
        const { booking } = await t.bookOnline(app, t.booking({ date: DAY, timeslot: '2pm', email: 'late@example.test' }));
        assert.ok(booking);
        assert.match(mocks.stripe.created[0].custom_text.submit.message, /will be charged at 3pm on .*, when your trip starts \(it leaves from the Maseline Harbour\)\./);
        const confirmation = mocks.sent('late@example.test')[0];
        assert.equal(confirmation.subject, `Your boat trip on ${t.short(DAY)} at 3pm is confirmed`);
        assert.match(confirmation.text, /Please note: this trip leaves from the Maseline Harbour, not the Creux Harbour\./);
        assert.match(confirmation.text, /Payment: £80, charged to your saved card at 3pm on the day/);
        assert.match(mocks.sent(t.OWNER)[0].subject, /^New booking: .*, 3pm /);
        assert.match(mocks.sent(t.OWNER)[0].text, /When: .* at 3pm \(moved from 2pm\)\nHarbour: Maseline Harbour/);
    });

    it('the reminder the evening before gives the new time and harbour', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test' });
        await change({ startTime: '15:00', harbour: 'maseline' });
        mocks.reset();
        // 6pm Guernsey time the evening before DAY: 6pm on the day before, which is 17:00 or 18:00 UTC
        const evening = new Date(tripStartsAt(t.day(9), '2pm', '18:30').getTime());
        await runDueReminders(evening);
        const [mail] = mocks.sent('ann@example.test');
        assert.equal(mail.subject, 'See you tomorrow at 3pm');
        assert.match(mail.text, /Please note: this trip leaves from the Maseline Harbour/);
    });

    it('a cancellation afterwards gives the trip\'s time that day', async () => {
        const id = await card({ firstName: 'Ann', email: 'ann@example.test' });
        await change({ startTime: '15:00' });
        mocks.reset();
        await t.call(app, 'post', '/bookings/cancel', { token, body: { _id: id } });
        assert.equal(mocks.sent('ann@example.test')[0].subject, `Your boat trip on ${t.short(DAY)} at 3pm has been cancelled`);
    });
});

describe('messaging everyone on a trip', () => {
    const message = (body, { auth = true } = {}) => t.call(app, 'post', '/bookings/message-trip', { token: auth ? token : undefined, body: { date: DAY, timeslot: '2pm', message: 'Bring a jacket, it is choppy!', ...body } });

    it('is for the owner only', async () => {
        assert.equal((await message({}, { auth: false })).status, 401);
    });

    for (const [name, body, text] of [
        ['an empty message', { message: '   ' }, /write the message/],
        ['a message that is far too long', { message: 'x'.repeat(1001) }, /up to 1000/],
        ['a list instead of a message', { message: ['hi'] }, /write the message/],
        ['a trip that does not exist', { timeslot: '5pm' }, /which trip/],
        ['a date that is not a date', { date: '14-05-2027' }, /valid date/],
    ]) {
        it(`refuses ${name}`, async () => {
            const res = await message(body);
            assert.equal(res.status, 400);
            assert.match(res.body.data, text);
        });
    }

    it('says so, and sends nothing, when nobody is booked on the trip', async () => {
        await t.insertBooking({ date: DAY, timeslot: '2pm', firstName: 'Gone', email: 'gone@example.test', status: 'cancelled' });
        const res = await message({});
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /Nobody is booked on the 2pm trip/);
        assert.equal(mocks.mails.length, 0);
    });

    it('everyone on the trip gets the message, each line as a paragraph, with their booking underneath', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test', adults: 2, children: 1 });
        await card({ firstName: 'Cee', email: 'cee@example.test', charter: 'true' });
        await card({ firstName: 'Gone', email: 'gone@example.test', status: 'cancelled' });
        await t.insertBooking({ date: DAY, timeslot: '11am', firstName: 'Morning', email: 'morning@example.test' });
        const res = await message({ message: 'Bring a jacket, it is choppy!\nSee you <soon> & thanks.' });
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /^Message sent to 2 customers on the 2pm trip on /);

        assert.deepEqual(toCustomers().map((m) => m.to).sort(), ['ann@example.test', 'cee@example.test'], 'not the cancelled booking, not the other trip');
        const mail = mocks.sent('ann@example.test')[0];
        assert.equal(mail.subject, `A message about your boat trip on ${t.short(DAY)} at 2pm`);
        assert.match(mail.text, /^A message about your trip\n\nDear Ann,\n\nBring a jacket, it is choppy!\n\nSee you <soon> & thanks\.\n\nYour booking:\n\nDate: /);
        assert.match(mail.text, /Party: 2 adults and 1 child\n/);
        assert.ok(mail.html.includes('See you &lt;soon&gt; &amp; thanks.'), 'escaped in the HTML');
        assert.equal(mail.attachments.some((a) => a.filename.endsWith('.ics')), false, 'no calendar file: nothing changed');
        assert.match(mocks.sent('cee@example.test')[0].subject, /^A message about your private charter on /);
    });

    it('on a moved trip, the booking underneath shows its time and harbour that day', async () => {
        await card({ firstName: 'Ann', email: 'ann@example.test' });
        await change({ startTime: '15:00', harbour: 'maseline', notifyCustomers: false });
        mocks.reset();
        await message({});
        const mail = mocks.sent('ann@example.test')[0];
        assert.equal(mail.subject, `A message about your boat trip on ${t.short(DAY)} at 3pm`);
        assert.match(mail.text, /Time: 3pm\nMeeting point: Maseline Harbour, Sark/);
    });

    it('the owner gets one summary: the message, who got it, and who could not be emailed', async () => {
        await card({ firstName: 'Ann', lastName: 'Smith', email: 'ann@example.test', phone: '0711' });
        await card({ firstName: 'NoMail', email: '' });
        await card({ firstName: 'Bounce', email: 'bounce@example.test' });
        mocks.failTo.add('bounce@example.test');
        const res = await message({ message: 'Bring a jacket' });
        assert.match(res.body.data, /Message sent to 1 customer on the 2pm trip on .*\. 2 not emailed \(no address, or the email failed\): see your email\./);
        const owner = mocks.sent(t.OWNER);
        assert.equal(owner.length, 1);
        assert.equal(owner[0].subject, `Message sent: 2pm ${t.short(DAY)}, 1 customer`);
        assert.match(owner[0].text, /You sent this message to everyone on the 2pm trip on .*:\n\nBring a jacket\n\nSent to 1 of 3 bookings:\n\n- Ann Smith, 2 adults, phone 0711\n\nNOT EMAILED[\s\S]*NoMail[\s\S]*Bounce/);
    });

    it('works after the trip too (a thank-you)', async () => {
        await t.insertBooking({ date: t.day(-2), timeslot: '11am', firstName: 'Ann', email: 'ann@example.test' });
        const res = await message({ date: t.day(-2), timeslot: '11am', message: 'Thank you for coming out with us!' });
        assert.equal(res.body.ok, true);
        assert.equal(mocks.sent('ann@example.test').length, 1);
    });
});
