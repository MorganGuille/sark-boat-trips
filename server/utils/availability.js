const Bookings = require('../models/bookings');
const Availability = require('../models/availability');
const { seatsFor } = require('./party');

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

module.exports = { getAvailability, isSlotEmpty };
