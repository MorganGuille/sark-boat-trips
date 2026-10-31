// Trip tools (spec P2-2). The day's trips as they are that day (public: the booking page and the
// dashboard show them), moving one trip to another time and/or harbour for that day, and sending
// everyone on a trip a message (dashboard only). The owner usually phones the customers first, so a
// change email is the written confirmation.
const Bookings = require('../models/bookings');
const Availability = require('../models/availability');
const { isDay, showDay } = require('../utils/dates');
const { TIMESLOTS } = require('../utils/validateBooking');
const { HARBOURS, USUAL_HARBOUR, usualStart, timeLabel, describeTrip, getTrip, getTripsForDay, withTrips } = require('../utils/trips');
const { HOURS } = require('../emails/calendar');
const { trySend } = require('../utils/mailer');
const emails = require('../emails');

// A trip can be moved to any time in this range, on the same day
const EARLIEST = '07:00';
const LATEST = '20:00';
const MAX_NOTE = 500;
const MAX_MESSAGE = 1000;

// Emails everyone on a trip (bookings with .trip, from withTrips). Saved changes come first: a failed
// email is reported, never undone. Returns how many were emailed and the bookings that weren't.
const emailEveryone = async (bookings, buildEmail) => {
    const notEmailed = [];
    let emailed = 0;
    for (const booking of bookings) {
        if (booking.email && await trySend(buildEmail(booking))) emailed++;
        else notEmailed.push(booking);
    }
    return { emailed, notEmailed };
};

const dayTrips = async (req, res) => {
    const { date } = req.params;
    if (!isDay(date)) return res.status(400).send({ ok: false, data: 'Invalid date.' });
    const trips = await getTripsForDay(date);
    res.send({
        ok: true,
        data: trips.map((trip) => ({
            timeslot: trip.timeslot, // the trip's name, which bookings store
            time: trip.time, // its time that day, e.g. '3pm'
            startTime: trip.startTime,
            timeChanged: trip.timeChanged,
            harbour: trip.harbour.name,
            harbourKey: trip.harbour.key,
            harbourChanged: trip.harbourChanged,
        })),
    });
};

const problemWith = ({ date, timeslot, startTime, harbour, note }) => {
    if (!isDay(date)) return 'Please choose a valid date.';
    if (typeof timeslot !== 'string' || !Object.hasOwn(TIMESLOTS, timeslot)) return 'Please choose which trip to change.';
    if (typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || startTime < EARLIEST || startTime > LATEST) {
        return `Please choose a time between ${timeLabel(EARLIEST)} and ${timeLabel(LATEST)}.`;
    }
    if (typeof harbour !== 'string' || !Object.hasOwn(HARBOURS, harbour)) return 'Please choose a harbour.';
    if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) return `The note can be up to ${MAX_NOTE} characters.`;
    return null;
};

// POST /bookings/change-trip { date, timeslot, startTime: '15:00', harbour: 'creux' | 'maseline', note, notifyCustomers }
const changeTrip = async (req, res) => {
    const problem = problemWith(req.body);
    if (problem) return res.status(400).send({ ok: false, data: problem });
    const { date, timeslot, startTime, harbour } = req.body;
    const note = (req.body.note || '').trim();
    const notify = req.body.notifyCustomers !== false && req.body.notifyCustomers !== 'false';

    const now = new Date();
    const before = await getTrip(date, timeslot);
    if (before.startsAt <= now) return res.send({ ok: false, data: `The ${before.time} trip on ${showDay(date)} has already started, so it can't be changed.` });
    if (before.startTime === startTime && before.harbour.key === harbour) {
        return res.send({ ok: false, data: `Nothing to change: the trip already leaves at ${before.time} from the ${before.harbour.name}.` });
    }
    const after = describeTrip(date, timeslot, { startTime, harbour });
    if (after.startsAt <= now) return res.send({ ok: false, data: `${after.time} on ${showDay(date)} has already passed. Please choose a later time.` });

    // Saved first (back to the usual time or harbour removes the change); the emails follow
    const set = {};
    const unset = {};
    if (startTime === usualStart(timeslot)) unset.startTime = ''; else set.startTime = startTime;
    if (harbour === USUAL_HARBOUR) unset.harbour = ''; else set.harbour = harbour;
    await Availability.findOneAndUpdate(
        { date, timeslot },
        { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) },
        { upsert: true }
    );

    // Trips last HOURS.trip: warn (but allow it) if this one now runs into the other
    const clash = (await getTripsForDay(date)).find((other) => other.timeslot !== timeslot &&
        Math.abs(other.startsAt.getTime() - after.startsAt.getTime()) < HOURS.trip * 3600000);
    const warning = clash ? `It now overlaps the ${clash.time} trip (trips last ${HOURS.trip} hours).` : '';

    const bookings = await withTrips(await Bookings.find({ date, timeslot, status: { $ne: 'cancelled' } }));
    const { emailed, notEmailed } = notify
        ? await emailEveryone(bookings, (booking) => emails.tripChangedEmail(booking, { before, note }))
        : { emailed: 0, notEmailed: [] };
    await trySend(emails.tripChangedOwnerEmail({ trip: after, before, note, bookings, notEmailed, notified: notify, warning }));

    const told = !bookings.length
        ? 'There are no bookings on it.'
        : notify
            ? `${emailed} customer${emailed === 1 ? '' : 's'} emailed${notEmailed.length ? `, ${notEmailed.length} not emailed (see your email)` : ''}.`
            : `${bookings.length} booking${bookings.length === 1 ? '' : 's'} on it, not emailed (as you chose).`;
    res.send({
        ok: true,
        data: `The ${before.time} trip on ${showDay(date)} now leaves at ${after.time} from the ${after.harbour.name}. ${told}${warning ? ` ${warning}` : ''}`,
    });
};

// POST /bookings/message-trip { date, timeslot, message }: the owner's message to everyone booked on
// one trip (not cancelled bookings). Any day, past ones too (a thank-you after the trip).
const messageTrip = async (req, res) => {
    const { date, timeslot, message } = req.body;
    if (!isDay(date)) return res.status(400).send({ ok: false, data: 'Please choose a valid date.' });
    if (typeof timeslot !== 'string' || !Object.hasOwn(TIMESLOTS, timeslot)) return res.status(400).send({ ok: false, data: 'Please choose which trip.' });
    if (typeof message !== 'string' || !message.trim()) return res.status(400).send({ ok: false, data: 'Please write the message.' });
    if (message.length > MAX_MESSAGE) return res.status(400).send({ ok: false, data: `The message can be up to ${MAX_MESSAGE} characters.` });

    const trip = await getTrip(date, timeslot);
    const bookings = await withTrips(await Bookings.find({ date, timeslot, status: { $ne: 'cancelled' } }));
    if (!bookings.length) return res.send({ ok: false, data: `Nobody is booked on the ${trip.time} trip on ${showDay(date)}, so there is no one to message.` });

    const { emailed, notEmailed } = await emailEveryone(bookings, (booking) => emails.tripMessageEmail(booking, message.trim()));
    await trySend(emails.tripMessageOwnerEmail({ trip, message: message.trim(), bookings, notEmailed }));

    res.send({
        ok: true,
        data: `Message sent to ${emailed} customer${emailed === 1 ? '' : 's'} on the ${trip.time} trip on ${showDay(date)}.${notEmailed.length ? ` ${notEmailed.length} not emailed (no address, or the email failed): see your email.` : ''}`,
    });
};

module.exports = { dayTrips, changeTrip, messageTrip, EARLIEST, LATEST };
