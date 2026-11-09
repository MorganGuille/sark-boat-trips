// The day's trips (spec P2-2). Every day has the usual two trips, 11am and 2pm, leaving from the Creux
// Harbour. For one day the owner can move a trip to another time and/or to the Maseline Harbour (low tide),
// from the dashboard (controllers/trips.js). The change is kept on that trip's Availability row (startTime,
// harbour), next to its seats. Bookings keep their timeslot ('11am' or '2pm'), which names the trip; its
// actual time and harbour always come from here: the card charge, the booking cutoff, every email, the
// calendar file and the booking page all ask getTrip / withTrips.
//
// The owner can also add extra trips to a day (a swim trip, a sunset trip), each with its own name,
// time, harbour, seats, length and adult and child prices. An extra trip is an Availability row with
// extra: true and a made-up timeslot ('x3fa9c1') that its bookings store, so seat counting, prices
// saved on bookings and everything above work for it unchanged.
const crypto = require('crypto');
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

const isUsual = (timeslot) => typeof timeslot === 'string' && Object.hasOwn(TIMESLOTS, timeslot);
const isValidStart = (startTime) => typeof startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime);

// A name for a new extra trip, unique enough for one day
const newExtraTimeslot = () => `x${crypto.randomBytes(3).toString('hex')}`;

// One trip as everything else needs it. row: its Availability row, if there is one.
// A booking with an unknown timeslot (very old data, or a trip that no longer exists) gets its
// timeslot as the time and no start moment.
const describeTrip = (date, timeslot, row) => {
    const harbourKey = Object.hasOwn(HARBOURS, row?.harbour || '') ? row.harbour : USUAL_HARBOUR;
    const harbour = { key: harbourKey, ...HARBOURS[harbourKey] };
    const extra = Boolean(row?.extra) && isValidStart(row.startTime);
    if (!isUsual(timeslot) && !extra) {
        return { date, timeslot, startTime: null, time: timeslot, label: timeslot, named: `${timeslot} trip`, startsAt: null, timeChanged: false, harbour, harbourChanged: false, extra: false };
    }
    const startTime = row?.startTime || usualStart(timeslot);
    const time = timeLabel(startTime);
    return {
        date,
        timeslot,
        startTime, // '15:00'
        time, // '3pm', what people read
        label: extra ? `${row.name} (${time})` : time, // how the dashboard names it: '3pm', 'Swim trip (4:30pm)'
        named: extra ? `${row.name} (${time})` : `${time} trip`, // in a sentence: 'the 3pm trip', 'the Swim trip (4:30pm)'
        startsAt: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? tripStartsAt(date, timeslot, startTime) : null, // a Date
        timeChanged: !extra && startTime !== usualStart(timeslot),
        timeMovedAt: row?.timeMovedAt || null, // when the owner last changed its time, if ever (a Date)
        usualTime: extra ? null : timeslot,
        harbour, // { key, name, map }
        harbourChanged: harbourKey !== USUAL_HARBOUR,
        extra,
        ...(extra && {
            name: row.name, // 'Swim trip'
            note: row.note || '', // 'Bring swimwear and a towel'
            hours: row.hours, // how long it lasts
            capacity: row.capacity, // seats
            prices: { adult: row.prices?.adult, child: row.prices?.child }, // pence
            removed: Boolean(row.removed),
        }),
    };
};

const getTrip = async (date, timeslot) => describeTrip(date, timeslot, await Availability.findOne({ date, timeslot }));

// A trip that exists that day (a usual one, or an extra one that hasn't been removed), or null
const findTrip = async (date, timeslot) => {
    if (typeof timeslot !== 'string' || !timeslot) return null;
    const trip = await getTrip(date, timeslot);
    return isUsual(timeslot) || (trip.extra && !trip.removed) ? trip : null;
};

// The trips of one day as they are that day: the usual two and any extra ones, in time order.
// rows: that day's Availability rows.
const USUAL_TIMESLOTS = Object.keys(TIMESLOTS);
const tripsOfDay = (date, rows) => {
    const usual = USUAL_TIMESLOTS.map((slot) => describeTrip(date, slot, rows.find((r) => r.timeslot === slot)));
    const extras = rows.filter((r) => r.extra && !r.removed).map((r) => describeTrip(date, r.timeslot, r)).filter((t) => t.extra);
    return [...usual, ...extras].sort((a, b) => a.startTime.localeCompare(b.startTime));
};
const getTripsForDay = async (date) => tripsOfDay(date, await Availability.find({ date }));

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
// Every booking also gets its manage-my-booking codes first (utils/manage.js), so customer emails can link to it.
const withTrips = async (bookings) => {
    await require('./manage').ensureManageLinks(bookings);
    const trips = await tripsFor(bookings);
    return bookings.map((b) => ({ ...(typeof b.toObject === 'function' ? b.toObject() : b), trip: tripOfBooking(trips, b) }));
};
const withTrip = async (booking) => (await withTrips([booking]))[0];

module.exports = { HARBOURS, USUAL_HARBOUR, usualStart, timeLabel, isUsual, isValidStart, newExtraTimeslot, describeTrip, getTrip, findTrip, tripsOfDay, USUAL_TIMESLOTS, getTripsForDay, tripsFor, tripOfBooking, withTrips, withTrip };
