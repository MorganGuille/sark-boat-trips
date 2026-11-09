// The models' indexes and defaults (spec P3-3): the searches the site makes most often (a day's
// bookings, one trip's, a month's) have an index, and a missing child or infant count reads as 0.
const t = require('./helpers');
t.setEnv();
t.installMocks();
require('../app');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Bookings = require('../models/bookings');
const Availability = require('../models/availability');
const Notes = require('../models/notes');

before(() => t.startDb());
after(() => t.stopDb());

const keysOf = async (Model) => {
    await Model.init();
    return (await Model.listIndexes()).map((index) => Object.keys(index.key).join(','));
};

describe('indexes', () => {
    it('bookings by day, trip and status; trip changes by day and trip; notes by day', async () => {
        assert.ok((await keysOf(Bookings)).includes('date,timeslot,status'));
        assert.ok((await keysOf(Availability)).includes('date,timeslot'));
        assert.ok((await keysOf(Notes)).includes('date'));
    });

    it('the day view and seat counting use the bookings index, not a scan of every booking', async () => {
        const plan = await Bookings.find({ date: t.day(10), timeslot: '11am', status: { $ne: 'cancelled' } }).explain('queryPlanner');
        assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /IXSCAN.*date_1_timeslot_1_status_1/);
    });
});

describe('party size defaults', () => {
    it('a new booking without children or infants has 0 of each', async () => {
        const booking = new Bookings({ date: t.day(10), timeslot: '11am', adults: 2 });
        assert.deepEqual([booking.children, booking.infants], [0, 0]);
    });

    it('an older booking saved without them reads as 0', async () => {
        const id = await t.insertBooking({ children: undefined });
        await require('mongoose').connection.db.collection('bookings').updateOne({ _id: Bookings.castObject({ _id: id })._id }, { $unset: { children: '', infants: '' } });
        const booking = await Bookings.findById(id);
        assert.deepEqual([booking.children, booking.infants], [0, 0]);
    });
});

describe('booking references', () => {
    const { unusedReference } = require('../utils/bookingCodes');

    it('a reference another booking has is never given out: it draws again until one is free', async () => {
        const asked = [];
        const reference = await unusedReference(async (candidate) => { asked.push(candidate); return asked.length <= 2; });
        assert.equal(asked.length, 3);
        assert.equal(reference, asked[2]);
        assert.equal(new Set(asked).size, 3);
        assert.match(reference, /^SBT-[2-9A-HJKMNP-Z]{6}$/);
    });

    it('a new booking checks its reference against the others before it is saved', async () => {
        const exists = Bookings.exists;
        const asked = [];
        // the first reference it draws is "taken"
        Bookings.exists = (filter) => { asked.push(filter.reference); return asked.length === 1 ? Promise.resolve({ _id: 1 }) : exists.call(Bookings, filter); };
        try {
            const booking = await new Bookings({ date: t.day(10), timeslot: '11am', adults: 2 }).save({ validateBeforeSave: false });
            assert.equal(asked.length, 2);
            assert.equal(booking.reference, asked[1]);
            assert.notEqual(booking.reference, asked[0]);
        } finally {
            Bookings.exists = exists;
        }
    });
});
