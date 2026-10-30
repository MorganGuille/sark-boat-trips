// The day's trips (spec P2-2). Every day has the usual two trips, 11am and 2pm, leaving from the Creux
// Harbour. For one day the owner can move a trip to another time and/or to the Maseline Harbour (low tide),
// from the dashboard (controllers/trips.js). The change is kept on that trip's Availability row (startTime,
// harbour), next to its seats. Bookings keep their timeslot ('11am' or '2pm'), which names the trip; its
// actual time and harbour always come from here: the card charge, the booking cutoff, every email, the
// calendar file and the booking page all ask getTrip / withTrips.
const Availability = require('../models/availability');
const { TIMESLOTS, tripStartsAt } = require('./validateBooking');

const HARBOURS = {
    creux: { name: 'Creux Harbour', map: 'https://maps.app.goo.gl/E2XLJqrGku7eDePZ8' },
    maseline: { name: 'Maseline Harbour', map: 'https://maps.app.goo.gl/nLfAgzx3fiaw66z88' },
};
const USUAL_HARBOUR = 'creux';

const usualStart = (timeslot) => `${String(TIMESLOTS[timeslot]).padStart(2, '0')}:00`;

// '15:00' becomes '3pm', '14:30' '2:30pm', '11:00' '11am', '12:15' '12:15pm'
const timeLabel = (startTime) => {
    const [hour, minute] = startTime.split(':').map(Number);
    return `${((hour + 11) % 12) + 1}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${hour >= 12 ? 'pm' : 'am'}`;
};

// One trip as everything else needs it. row: its Availability row, if there is one.
// A booking with an unknown timeslot (very old data) gets its timeslot as the time and no start moment.
const describeTrip = (date, timeslot, row) => {
    const harbourKey = Object.hasOwn(HARBOURS, row?.harbour || '') ? row.harbour : USUAL_HARBOUR;
    const harbour = { key: harbourKey, ...HARBOURS[harbourKey] };
    if (!Object.hasOwn(TIMESLOTS, timeslot || '')) {
        return { date, timeslot, startTime: null, time: timeslot, startsAt: null, timeChanged: false, harbour, harbourChanged: false };
    }
    const startTime = row?.startTime || usualStart(timeslot);
    return {
        date,
        timeslot,
        startTime, // '15:00'
        time: timeLabel(startTime), // '3pm', what people read
        startsAt: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? tripStartsAt(date, timeslot, startTime) : null, // a Date
        timeChanged: startTime !== usualStart(timeslot),
        usualTime: timeslot,
        harbour, // { key, name, map }
        harbourChanged: harbourKey !== USUAL_HARBOUR,
    };
};

const getTrip = async (date, timeslot) => describeTrip(date, timeslot, await Availability.findOne({ date, timeslot }));

// The usual trips of one day, as they are that day
const getTripsForDay = async (date) => {
    const rows = await Availability.find({ date });
    return Object.keys(TIMESLOTS).map((slot) => describeTrip(date, slot, rows.find((r) => r.timeslot === slot)));
};

const key = (date, timeslot) => `${date}|${timeslot}`;

// The trip of each booking, in one database read: a Map from 'date|timeslot'
const tripsFor = async (bookings) => {
    const dates = [...new Set(bookings.map((b) => b.date).filter(Boolean))];
    const rows = dates.length ? await Availability.find({ date: { $in: dates } }) : [];
    const trips = new Map();
    for (const b of bookings) {
        if (!trips.has(key(b.date, b.timeslot))) {
            trips.set(key(b.date, b.timeslot), describeTrip(b.date, b.timeslot, rows.find((r) => r.date === b.date && r.timeslot === b.timeslot)));
        }
    }
    return trips;
};
const tripOfBooking = (trips, booking) => trips.get(key(booking.date, booking.timeslot));

// The bookings as plain objects with .trip added, ready for the emails (emails/index.js)
const withTrips = async (bookings) => {
    const trips = await tripsFor(bookings);
    return bookings.map((b) => ({ ...(typeof b.toObject === 'function' ? b.toObject() : b), trip: tripOfBooking(trips, b) }));
};
const withTrip = async (booking) => (await withTrips([booking]))[0];

module.exports = { HARBOURS, USUAL_HARBOUR, usualStart, timeLabel, describeTrip, getTrip, getTripsForDay, tripsFor, tripOfBooking, withTrips, withTrip };
