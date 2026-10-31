const Bookings = require('../models/bookings');
const Availability = require('../models/availability');
const { seatsFor } = require('./party');
const { showDay } = require('./dates');

const DEFAULT_CAPACITY = 12;

// What is booked on one trip (a date and a timeslot). Cancelled bookings never count.
// excludeId leaves one booking out, for checking whether an edit to that booking would fit.
const getSlotState = async (date, timeslot, excludeId) => {
    const [settings, bookings] = await Promise.all([
        Availability.findOne({ date, timeslot }),
        Bookings.find({ date, timeslot, status: { $ne: 'cancelled' }, ...(excludeId && { _id: { $ne: excludeId } }) }),
    ]);

    const capacity = settings && Number.isFinite(settings.capacity) ? settings.capacity : DEFAULT_CAPACITY;
    const bookedSeats = bookings.reduce((sum, b) => sum + seatsFor(b), 0);

    return {
        capacity,
        bookedSeats,
        bookingCount: bookings.length,
        hasCharter: bookings.some((b) => b.charter === 'true'),
    };
};

// Seats left on a trip (everyone takes a seat, infants too). A private charter takes the whole trip, whatever its party size.
const getAvailability = async (date, timeslot, excludeId) => {
    const { capacity, bookedSeats, hasCharter } = await getSlotState(date, timeslot, excludeId);
    return hasCharter ? 0 : capacity - bookedSeats;
};

// A charter needs the whole trip: it must be open (capacity above 0) and have no other bookings
const isSlotEmpty = async (date, timeslot, excludeId) => {
    const { capacity, bookingCount } = await getSlotState(date, timeslot, excludeId);
    return capacity > 0 && bookingCount === 0;
};

// One booking change at a time per trip (spec P2-12). Checking for room and then saving takes a few
// steps, so two customers saving their cards for the last seats at the same moment could both pass
// the check. Everything that adds people to a trip (online bookings, dashboard add, edit and
// restore) does its check and save inside this, so the second one waits and sees the first.
// Different trips don't wait for each other. It lives in memory, which is enough for the single
// copy of the app that runs on Heroku (like the rate limits; see CLAUDE.md if that ever changes).
const queues = new Map();
const withTripLock = (date, timeslot, fn) => {
    const key = `${date} ${timeslot}`;
    const result = (queues.get(key) || Promise.resolve()).then(() => fn());
    const done = result.catch(() => {}); // a failure must not block the trip for the next one
    queues.set(key, done);
    done.then(() => { if (queues.get(key) === done) queues.delete(key); });
    return result;
};

// Why a booking doesn't fit, in words: how many spaces are left and how many it needs, rather than
// just "no spaces". owner: worded for the dashboard instead of the customer.
const noRoomMessage = ({ trip, date, left, booking, owner = false }) => {
    const on = `the ${trip.named} on ${showDay(date)}`;
    if (booking.charter === 'true') {
        return `Sorry, ${on} already has bookings, and a private charter needs the whole boat. Please choose another trip.`;
    }
    if (left <= 0) return owner ? `${on.replace(/^t/, 'T')} is full.` : `Sorry, ${on} is full. Please choose another trip.`;
    const spaces = `${left} space${left === 1 ? '' : 's'}`;
    const wanted = seatsFor(booking);
    const infants = booking.infants > 0 ? ' (infants take a seat too)' : '';
    return owner
        ? `Only ${spaces} left on ${on}, and this booking is for ${wanted}${infants}. Raise the trip's seats first if you want to fit them in.`
        : `Sorry, there ${left === 1 ? 'is' : 'are'} only ${spaces} left on ${on}, and you asked for ${wanted}${infants}. Please book fewer people or choose another trip.`;
};

module.exports = { getAvailability, isSlotEmpty, withTripLock, noRoomMessage };
