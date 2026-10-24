// The owner's dashboard: adding, finding, editing, cancelling, restoring and deleting bookings.
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

const post = (path, body) => t.call(app, 'post', path, { body, token });
const get = (path) => t.call(app, 'get', path, { token });
const all = () => db.collection('bookings').find({}).toArray();
const edit = (id, body) => post(`/bookings/update/${id}`, body);
const withEmail = (extra = {}) => t.insertBooking({ firstName: 'Bob', lastName: 'Jones', email: 'bob@example.test', phone: '07000 000000', accommodation: 'Hotel', message: 'hi', ...extra });

describe('adding a booking on the dashboard', () => {
    it('details can be missing: a date, trip time and a name is enough, and no email is sent without an address', async () => {
        const res = await post('/bookings/admin-add', { date: t.day(10), timeslot: '11am', firstName: 'Walk-up' });
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.match(res.body.data, /no email address, so no confirmation was sent/);
        const [b] = await all();
        assert.equal(b.firstName, 'Walk-up');
        assert.equal(b.status, 'active');
        assert.equal(mocks.mails.length, 0);
    });
    it('with an email address the customer gets a confirmation', async () => {
        const res = await post('/bookings/admin-add', { date: t.day(10), timeslot: '2pm', firstName: 'Bob', lastName: 'Jones', email: 'bob@example.test', adults: '2' });
        assert.match(res.body.data, /saved and confirmation email sent/);
        assert.ok(mocks.sent('bob@example.test').some((m) => /Booking Confirmation/.test(m.subject)));
    });
    it('past dates and dates outside the season are allowed (a walk-up from earlier, a special trip)', async () => {
        for (const date of [t.day(-3), t.day(-100), t.day(400)]) {
            assert.equal((await post('/bookings/admin-add', { date, timeslot: '11am', firstName: 'Odd' })).body.ok, true, date);
        }
    });
    it('still will not overfill a trip', async () => {
        await t.insertBooking({ date: t.day(10), adults: 11 });
        const res = await post('/bookings/admin-add', { date: t.day(10), timeslot: '11am', firstName: 'Late', adults: '2' });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /No spaces available/);
        assert.equal((await all()).length, 1);
    });
    it('a missing party size is stored as 0 and uses no seats', async () => {
        await post('/bookings/admin-add', { date: t.day(10), timeslot: '11am', firstName: 'Unknown size' });
        const [b] = await all();
        assert.equal(b.adults, 0);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 12);
    });
    it('what is entered must still make sense', async () => {
        const base = { date: t.day(10), timeslot: '11am', firstName: 'X' };
        for (const bad of [{ date: '31-02-2033' }, { timeslot: '3pm' }, { adults: '13' }, { adults: '0' }, { children: '-1' }, { email: 'nope' }, { charter: 'maybe' }, { date: undefined }]) {
            assert.equal((await post('/bookings/admin-add', { ...base, ...bad })).status, 400, JSON.stringify(bad));
        }
        assert.equal((await all()).length, 0);
    });
});

describe('finding bookings', () => {
    it('the day view lists that day only, and hides cancelled bookings unless asked', async () => {
        await withEmail({ date: t.day(10), lastName: 'Today' });
        await withEmail({ date: t.day(10), lastName: 'Gone', status: 'cancelled' });
        await withEmail({ date: t.day(11), lastName: 'Tomorrow' });
        assert.deepEqual((await get(`/bookings/${t.day(10)}`)).body.data.map((b) => b.lastName), ['Today']);
        const withCancelled = (await get(`/bookings/${t.day(10)}?includeCancelled=true`)).body.data.map((b) => b.lastName).sort();
        assert.deepEqual(withCancelled, ['Gone', 'Today']);
    });
    it('search matches part of a last name in any case, and hides cancelled bookings unless asked', async () => {
        await withEmail({ lastName: 'Smithson' });
        await withEmail({ lastName: 'Smith', status: 'cancelled' });
        await withEmail({ lastName: 'Jones' });
        assert.deepEqual((await get('/bookings/search/SMITH')).body.data.map((b) => b.lastName), ['Smithson']);
        assert.equal((await get('/bookings/search/smith?includeCancelled=true')).body.data.length, 2);
        assert.equal((await get('/bookings/search/nobody')).body.data.length, 0);
    });
});

describe('editing a booking', () => {
    it('an unknown or malformed ID is a clean 404 and nothing is emailed', async () => {
        for (const id of ['64b000000000000000000000', 'zzz']) assert.equal((await edit(id, { phone: '9' })).status, 404, id);
        assert.equal(mocks.mails.length, 0);
    });
    it('a cancelled booking cannot be edited until it is restored (409)', async () => {
        const id = await withEmail({ status: 'cancelled' });
        assert.equal((await edit(id, { phone: '9' })).status, 409);
    });
    it('what is entered must still make sense (400, nothing changed)', async () => {
        const id = await withEmail();
        for (const body of [{ date: '31-02-2033' }, { timeslot: 'noon' }, { adults: '99' }, { email: 'nope' }, { date: [t.day(11)] }, { firstName: { $ne: null } }]) {
            assert.equal((await edit(id, body)).status, 400, JSON.stringify(body));
        }
        assert.equal((await t.findBooking(id)).phone, '07000 000000');
    });

    describe('does it fit?', () => {
        it('adding people beyond the seats left is refused, and nothing changes or is emailed', async () => {
            await t.insertBooking({ date: t.day(10), adults: 6 });
            const id = await withEmail({ date: t.day(10), adults: 4 });
            const res = await edit(id, { adults: '8' });
            assert.equal(res.body.ok, false);
            assert.match(res.body.data, /only 6 spaces left/);
            assert.equal((await t.findBooking(id)).adults, 4);
            assert.equal(mocks.mails.length, 0);
            assert.equal((await edit(id, { adults: '6' })).body.ok, true, 'exactly what fits is fine');
        });
        it('moving to a full trip is refused, moving to a free one works and the customer is told the new date', async () => {
            await t.insertBooking({ date: t.day(11), adults: 12 });
            const id = await withEmail({ date: t.day(10) });
            assert.equal((await edit(id, { date: t.day(11) })).body.ok, false);
            assert.equal((await t.findBooking(id)).date, t.day(10));
            const res = await edit(id, { date: t.day(12) });
            assert.equal(res.body.ok, true);
            assert.equal((await t.findBooking(id)).date, t.day(12));
            const email = mocks.sent('bob@example.test').find((m) => /UPDATED/.test(m.subject));
            assert.ok(email.html.includes(t.day(12)) && email.html.includes('11am'));
        });
        it('taking people away, or editing contact details, never needs room (an over-full trip can still be edited)', async () => {
            await t.insertBooking({ date: t.day(10), adults: 10 });
            const id = await withEmail({ date: t.day(10), adults: 10 });
            assert.equal((await edit(id, { adults: '9' })).body.ok, true);
            assert.equal((await edit(id, { phone: '0777' })).body.ok, true);
            assert.equal((await edit(id, { adults: '10' })).body.ok, false, 'but adding the person back is refused');
        });
        it('a blank adults box leaves the number alone, so the seats are not freed by accident', async () => {
            const id = await withEmail({ adults: 4 });
            await edit(id, { adults: '', phone: '0123' });
            assert.equal((await t.findBooking(id)).adults, 4);
        });
        it('a blank children box means no children', async () => {
            const id = await withEmail({ children: 3 });
            await edit(id, { children: '' });
            assert.equal((await t.findBooking(id)).children, 0);
        });
    });

    describe('charters', () => {
        it('a booking can only become a charter when nothing else is on the trip, and then it blocks the trip', async () => {
            const other = await t.insertBooking({ date: t.day(10), adults: 2 });
            const id = await withEmail({ date: t.day(10), adults: 1 });
            const refused = await edit(id, { charter: 'true' });
            assert.equal(refused.body.ok, false);
            assert.match(refused.body.data, /other bookings/);
            assert.equal((await t.findBooking(id)).charter, 'false');
            await db.collection('bookings').updateOne({ _id: (await t.findBooking(other))._id }, { $set: { status: 'cancelled' } });
            assert.equal((await edit(id, { charter: 'true' })).body.ok, true);
            assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 0);
            assert.equal((await edit(id, { charter: 'false' })).body.ok, true);
            assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 11);
        });
        it('moving a booking onto a chartered trip is refused', async () => {
            await t.insertBooking({ date: t.day(10), adults: 2, charter: 'true' });
            const id = await withEmail({ date: t.day(11), adults: 1 });
            const res = await edit(id, { date: t.day(10) });
            assert.equal(res.body.ok, false);
            assert.match(res.body.data, /0 spaces/);
        });
    });

    describe('telling the customer', () => {
        it('the customer is emailed by default, and so is the owner', async () => {
            const id = await withEmail();
            const res = await edit(id, { phone: '111' });
            assert.match(res.body.data, /updated successfully and email sent/);
            assert.ok(mocks.sent('bob@example.test').some((m) => m.subject === 'Booking UPDATED - Sark Boat Trips'));
            assert.ok(mocks.sent(t.OWNER).some((m) => m.subject === 'Booking UPDATED'));
        });
        it('with notifyCustomer false the change is saved and only the owner gets the copy', async () => {
            const id = await withEmail();
            const res = await edit(id, { phone: '111', notifyCustomer: false });
            assert.match(res.body.data, /customer not emailed, as you asked/);
            assert.equal((await t.findBooking(id)).phone, '111');
            assert.equal(mocks.sent('bob@example.test').length, 0);
            assert.equal(mocks.sent(t.OWNER).length, 1);
        });
        it('a booking with no email address sends no customer email', async () => {
            const id = await withEmail({ email: '' });
            await edit(id, { phone: '111' });
            assert.deepEqual(mocks.sent().map((m) => m.to), [t.OWNER]);
        });
        it('saving with no changes says so and sends nothing', async () => {
            const id = await withEmail();
            const res = await edit(id, { phone: '07000 000000', accommodation: 'Hotel', adults: '2', date: t.day(10), timeslot: '11am', email: 'bob@example.test', charter: 'false' });
            assert.match(res.body.data, /No changes to save/);
            assert.equal(mocks.mails.length, 0);
        });
        it('the emails read sensibly for a booking with no name or children recorded', async () => {
            const id = await withEmail({ firstName: undefined, lastName: undefined });
            await db.collection('bookings').updateOne({ _id: (await t.findBooking(id))._id }, { $unset: { children: '', firstName: '', lastName: '' } });
            await edit(id, { phone: '4' });
            const customer = mocks.sent('bob@example.test')[0], owner = mocks.sent(t.OWNER)[0];
            assert.match(customer.html, /Dear guest/);
            assert.match(customer.html, /2 adults and 0 children/);
            assert.match(owner.html, /\(no name\)/);
            assert.doesNotMatch(customer.html + owner.html, /undefined/);
        });
    });

    describe('clearing details', () => {
        it('an empty value clears accommodation, message, email and name; fields not sent are untouched', async () => {
            const id = await withEmail();
            const res = await edit(id, { accommodation: '', message: '', email: '', firstName: '' });
            assert.equal(res.body.ok, true);
            const b = await t.findBooking(id);
            assert.deepEqual([b.accommodation, b.message, b.email, b.firstName], [undefined, undefined, undefined, undefined]);
            assert.deepEqual([b.lastName, b.phone, b.adults], ['Jones', '07000 000000', 2]);
            assert.deepEqual(mocks.sent().map((m) => m.to), [t.OWNER], 'with the email cleared only the owner is told');
        });
        it('the date, trip time and booking type can never be blanked', async () => {
            const id = await withEmail();
            await edit(id, { date: '', timeslot: '', charter: '', phone: '5' });
            const b = await t.findBooking(id);
            assert.deepEqual([b.date, b.timeslot, b.charter], [t.day(10), '11am', 'false']);
        });
    });
});

describe('cancelling, restoring and deleting', () => {
    it('cancelling keeps the booking, frees its seats, hides it from the day view, and emails the customer and the owner', async () => {
        const id = await withEmail({ adults: 5 });
        const res = await post('/bookings/cancel', { _id: id });
        assert.match(res.body.data, /cancelled and email sent/);
        const b = await t.findBooking(id);
        assert.equal(b.status, 'cancelled');
        assert.ok(b.cancelledAt instanceof Date);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 12);
        assert.equal((await get(`/bookings/${t.day(10)}`)).body.data.length, 0);
        assert.ok(mocks.sent('bob@example.test').some((m) => m.subject === 'Booking CANCELLED - Sark Boat Trips'));
        assert.ok(mocks.sent(t.OWNER).some((m) => m.subject === `Booking CANCELLED ${t.day(10)}`));
    });
    it('a booking with no email address is cancelled without a customer email', async () => {
        const id = await withEmail({ email: '' });
        assert.match((await post('/bookings/cancel', { _id: id })).body.data, /cancelled$/);
        assert.deepEqual(mocks.sent().map((m) => m.to), [t.OWNER]);
    });
    it('cancelling twice, or an unknown booking, is a 404', async () => {
        const id = await withEmail();
        await post('/bookings/cancel', { _id: id });
        assert.equal((await post('/bookings/cancel', { _id: id })).status, 404);
        assert.equal((await post('/bookings/cancel', { _id: '64b000000000000000000000' })).status, 404);
    });
    it('restoring brings the booking and its seats back and sends the confirmation again', async () => {
        const id = await withEmail({ adults: 4 });
        await post('/bookings/cancel', { _id: id });
        mocks.reset();
        const res = await post('/bookings/restore', { _id: id });
        assert.match(res.body.data, /restored and confirmation email sent/);
        const b = await t.findBooking(id);
        assert.equal(b.status, 'active');
        assert.equal(b.cancelledAt, undefined);
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 8);
        assert.ok(mocks.sent('bob@example.test').some((m) => /Booking Confirmation/.test(m.subject)));
    });
    it('restoring is refused when the trip has filled up since, and nothing is emailed', async () => {
        const id = await withEmail({ adults: 4 });
        await post('/bookings/cancel', { _id: id });
        await t.insertBooking({ date: t.day(10), adults: 12 });
        mocks.reset();
        const res = await post('/bookings/restore', { _id: id });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /only 0 spaces left/);
        assert.equal((await t.findBooking(id)).status, 'cancelled');
        assert.equal(mocks.mails.length, 0);
    });
    it('only a cancelled booking can be restored', async () => {
        assert.equal((await post('/bookings/restore', { _id: await withEmail() })).status, 404);
    });
    it('a charter cannot be restored while the trip has other bookings', async () => {
        const charter = await withEmail({ adults: 2, charter: 'true', status: 'cancelled' });
        await t.insertBooking({ date: t.day(10), adults: 1 });
        const res = await post('/bookings/restore', { _id: charter });
        assert.equal(res.body.ok, false);
        assert.match(res.body.data, /already has other bookings/);
    });
    it('cancelling a charter frees the trip and restoring it blocks the trip again', async () => {
        const id = await withEmail({ adults: 2, charter: 'true' });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 0);
        await post('/bookings/cancel', { _id: id });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 12);
        await post('/bookings/restore', { _id: id });
        assert.equal((await t.seatsLeft(app, t.day(10)))['11am'], 0);
    });
    it('only a cancelled booking can be permanently deleted', async () => {
        const id = await withEmail();
        assert.equal((await post('/bookings/permanently-delete', { _id: id })).status, 404);
        assert.ok(await t.findBooking(id));
        await post('/bookings/cancel', { _id: id });
        mocks.reset();
        const res = await post('/bookings/permanently-delete', { _id: id });
        assert.match(res.body.data, /permanently deleted/);
        assert.equal(await t.findBooking(id), null);
        assert.equal(mocks.mails.length, 0, 'no email for a permanent delete');
    });
});
