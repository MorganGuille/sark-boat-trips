// Two people taking the last seats at the same moment (spec P2-12). The boat can never legally take
// more than 12, so whatever arrives at once, a trip never ends up with more seats booked than it has:
// the later customer gets the "trip filled up" booking (cancelled, nothing charged, both sides told).
const t = require('./helpers');
t.setEnv();
const mocks = t.installMocks();
const app = require('../app');
const { withTripLock } = require('../utils/availability');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let db, token;
before(async () => { db = await t.startDb(); });
after(() => t.stopDb());
beforeEach(async () => { await t.resetDb(); await t.seedSeason(); mocks.reset(); token = await t.login(app); });

const DAY = t.day(12);
const active = () => db.collection('bookings').find({ date: DAY, timeslot: '11am', status: 'active' }).toArray();
const seats = (bookings) => bookings.reduce((sum, b) => sum + (b.adults || 0) + (b.children || 0) + (b.infants || 0), 0);
const tripSession = (id) => t.cardSession(id, { kind: 'trip', date: DAY, adults: '2' });

describe('customers taking the last seats at the same moment', () => {
    it('only as many as fit are booked; the rest are told the trip filled up and nothing is charged', async () => {
        await t.insertBooking({ date: DAY, adults: 10 }); // 2 seats left
        const sessions = ['cs_race_a', 'cs_race_b', 'cs_race_c', 'cs_race_d'].map(tripSession);
        const replies = await Promise.all(sessions.map((session) => t.webhook(app, session)));
        assert.deepEqual(replies.map((r) => r.status), [200, 200, 200, 200]);

        assert.equal(seats(await active()), 12, 'never more than 12 on board');
        const online = await db.collection('bookings').find({ stripeSessionId: { $in: sessions.map((s) => s.id) } }).toArray();
        assert.equal(online.length, 4, 'every saved card is kept on the dashboard');
        assert.equal(online.filter((b) => b.status === 'active').length, 1);
        for (const b of online.filter((b) => b.status === 'cancelled')) {
            assert.match(b.paymentNote, /filled up .* Nothing was charged/);
            assert.match(mocks.sent(b.email)[0].subject, /is full$/, 'the customer is told');
        }
        const toOwner = mocks.sent(t.OWNER).map((m) => m.subject);
        assert.equal(toOwner.filter((s) => /Booking NOT made/.test(s)).length, 3, 'the owner hears about each one');
    });

    it('two charters for the same empty trip: only one gets it', async () => {
        const sessions = ['cs_race_charter1', 'cs_race_charter2'].map((id) => t.cardSession(id, { date: DAY }));
        await Promise.all(sessions.map((session) => t.webhook(app, session)));
        const booked = await active();
        assert.equal(booked.length, 1);
        assert.equal(booked[0].charter, 'true');
    });

    it('a charter and a trip booking at once: never both', async () => {
        await Promise.all([t.webhook(app, t.cardSession('cs_race_ch', { date: DAY })), t.webhook(app, tripSession('cs_race_tr'))]);
        assert.equal((await active()).length, 1);
    });

    it('the owner adding a booking on the dashboard while a customer books the last seats', async () => {
        await t.insertBooking({ date: DAY, adults: 10 });
        const [added] = await Promise.all([
            t.call(app, 'post', '/bookings/admin-add', { token, body: { date: DAY, timeslot: '11am', firstName: 'Phone', adults: '2' } }),
            t.webhook(app, tripSession('cs_race_owner')),
        ]);
        assert.equal(seats(await active()), 12);
        const online = await db.collection('bookings').findOne({ stripeSessionId: 'cs_race_owner' });
        assert.equal(added.body.ok, online.status === 'cancelled', 'exactly one of the two got the seats');
    });

    // Several customers at once, so the owner's change really does land in the middle of theirs
    const customersAtOnce = (name) => ['a', 'b', 'c'].map((n) => t.webhook(app, tripSession(`cs_race_${name}_${n}`)));

    it('the owner restoring a booking while customers book the last seats', async () => {
        await t.insertBooking({ date: DAY, adults: 10 });
        const cancelled = await t.insertBooking({ date: DAY, adults: 2, status: 'cancelled', cancelledAt: new Date() });
        await Promise.all([t.call(app, 'post', '/bookings/restore', { token, body: { _id: cancelled } }), ...customersAtOnce('restore')]);
        assert.equal(seats(await active()), 12);
    });

    it('the owner moving a booking onto the trip while customers book the last seats', async () => {
        await t.insertBooking({ date: DAY, adults: 10 });
        const elsewhere = await t.insertBooking({ date: DAY, timeslot: '2pm', adults: 2 });
        await Promise.all([t.call(app, 'post', `/bookings/update/${elsewhere}`, { token, body: { timeslot: '11am' } }), ...customersAtOnce('move')]);
        assert.equal(seats(await active()), 12);
    });

    it('bookings for different trips do not wait for each other, and a failure never blocks the trip', async () => {
        const order = [];
        let release;
        const slow = withTripLock(DAY, '11am', () => new Promise((resolve) => { release = resolve; }));
        await withTripLock(DAY, '2pm', async () => order.push('2pm'));
        assert.deepEqual(order, ['2pm'], 'the 2pm trip did not wait for the 11am one');
        const queued = withTripLock(DAY, '11am', async () => order.push('11am, second'));
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(order, ['2pm'], 'the second 11am change waits for the first');
        release();
        await slow;
        await queued;
        assert.deepEqual(order, ['2pm', '11am, second']);

        await assert.rejects(withTripLock(DAY, '11am', async () => { throw new Error('database down'); }), /database down/);
        assert.equal(await withTripLock(DAY, '11am', async () => 'still works'), 'still works');
    });
});
