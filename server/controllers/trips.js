// Trip tools (spec P2-2). The day's trips as they are that day (public: the booking page and the
// dashboard show them), moving one trip to another time and/or harbour for that day, sending
// everyone on a trip a message, and adding or deleting an extra trip (dashboard only). The owner usually phones the customers first, so a
// change email is the written confirmation.
const Bookings = require('../models/bookings');
const Availability = require('../models/availability');
const { isDay, showDay } = require('../utils/dates');
const { isTimeslot, MAX_CAPACITY } = require('../utils/validateBooking');
const { toPence } = require('../utils/prices');
const { HARBOURS, USUAL_HARBOUR, usualStart, timeLabel, isValidStart, newExtraTimeslot, describeTrip, getTrip, findTrip, getTripsForDay, withTrips } = require('../utils/trips');
const { HOURS } = require('../emails/calendar');
const { trySend } = require('../utils/mailer');
const emails = require('../emails');

// A trip can be moved to any time in this range, on the same day
const EARLIEST = '07:00';
const LATEST = '20:00';
const MAX_NOTE = 500;
const MAX_MESSAGE = 1000;
// An extra trip's name ('Swim trip'), the note customers see, and how long it can last
const MAX_NAME = 40;
const MAX_TRIP_NOTE = 300;
const MIN_HOURS = 0.5;
const MAX_HOURS = 8;

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

const pounds = (pence) => (pence / 100).toFixed(2).replace(/\.00$/, '');

const dayTrips = async (req, res) => {
    const { date } = req.params;
    if (!isDay(date)) return res.status(400).send({ ok: false, data: 'Invalid date.' });
    const trips = await getTripsForDay(date);
    res.send({
        ok: true,
        data: trips.map((trip) => ({
            timeslot: trip.timeslot, // the trip's name, which bookings store
            time: trip.time, // its time that day, e.g. '3pm'
            label: trip.label, // '3pm', or 'Swim trip (4:30pm)'
            startTime: trip.startTime,
            timeChanged: trip.timeChanged,
            harbour: trip.harbour.name,
            harbourKey: trip.harbour.key,
            harbourChanged: trip.harbourChanged,
            extra: trip.extra,
            // An extra trip's own details; prices in pounds, as the booking page shows them
            ...(trip.extra && { name: trip.name, note: trip.note, hours: trip.hours, prices: { adult: pounds(trip.prices.adult), child: pounds(trip.prices.child) } }),
        })),
    });
};

const timeProblem = (startTime) => !isValidStart(startTime) || startTime < EARLIEST || startTime > LATEST
    ? `Please choose a time between ${timeLabel(EARLIEST)} and ${timeLabel(LATEST)}.`
    : null;

const problemWith = ({ date, timeslot, startTime, harbour, note }) => {
    if (!isDay(date)) return 'Please choose a valid date.';
    if (!isTimeslot(timeslot)) return 'Please choose which trip to change.';
    if (timeProblem(startTime)) return timeProblem(startTime);
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
    const before = await findTrip(date, timeslot);
    if (!before) return res.status(400).send({ ok: false, data: 'That trip is not running on that day.' });
    if (before.startsAt <= now) return res.send({ ok: false, data: `The ${before.named} on ${showDay(date)} has already started, so it can't be changed.` });
    if (before.startTime === startTime && before.harbour.key === harbour) {
        return res.send({ ok: false, data: `Nothing to change: the trip already leaves at ${before.time} from the ${before.harbour.name}.` });
    }
    const row = await Availability.findOne({ date, timeslot });
    const after = describeTrip(date, timeslot, { ...(row?.toObject() || {}), startTime, harbour });
    if (after.startsAt <= now) return res.send({ ok: false, data: `${after.time} on ${showDay(date)} has already passed. Please choose a later time.` });

    // Saved first (back to the usual time or harbour removes the change); the emails follow
    const set = {};
    const unset = {};
    // (an extra trip has no usual time, so it always keeps its own)
    if (!before.extra && startTime === usualStart(timeslot)) unset.startTime = ''; else set.startTime = startTime;
    if (harbour === USUAL_HARBOUR) unset.harbour = ''; else set.harbour = harbour;
    await Availability.findOneAndUpdate(
        { date, timeslot },
        { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) },
        { upsert: true }
    );

    // Trips last HOURS.trip: warn (but allow it) if this one now runs into the other
    const clash = (await getTripsForDay(date)).find((other) => other.timeslot !== timeslot &&
        Math.abs(other.startsAt.getTime() - after.startsAt.getTime()) < HOURS.trip * 3600000);
    const warning = clash ? `It now overlaps the ${clash.named} (trips last ${HOURS.trip} hours).` : '';

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
        data: `The ${before.named} on ${showDay(date)} now leaves at ${after.time} from the ${after.harbour.name}. ${told}${warning ? ` ${warning}` : ''}`,
    });
};

// POST /bookings/message-trip { date, timeslot, message }: the owner's message to everyone booked on
// one trip (not cancelled bookings). Any day, past ones too (a thank-you after the trip).
const messageTrip = async (req, res) => {
    const { date, timeslot, message } = req.body;
    if (!isDay(date)) return res.status(400).send({ ok: false, data: 'Please choose a valid date.' });
    if (!isTimeslot(timeslot)) return res.status(400).send({ ok: false, data: 'Please choose which trip.' });
    if (typeof message !== 'string' || !message.trim()) return res.status(400).send({ ok: false, data: 'Please write the message.' });
    if (message.length > MAX_MESSAGE) return res.status(400).send({ ok: false, data: `The message can be up to ${MAX_MESSAGE} characters.` });

    const trip = await getTrip(date, timeslot);
    const bookings = await withTrips(await Bookings.find({ date, timeslot, status: { $ne: 'cancelled' } }));
    if (!bookings.length) return res.send({ ok: false, data: `Nobody is booked on the ${trip.named} on ${showDay(date)}, so there is no one to message.` });

    const { emailed, notEmailed } = await emailEveryone(bookings, (booking) => emails.tripMessageEmail(booking, message.trim()));
    await trySend(emails.tripMessageOwnerEmail({ trip, message: message.trim(), bookings, notEmailed }));

    res.send({
        ok: true,
        data: `Message sent to ${emailed} customer${emailed === 1 ? '' : 's'} on the ${trip.named} on ${showDay(date)}.${notEmailed.length ? ` ${notEmailed.length} not emailed (no address, or the email failed): see your email.` : ''}`,
    });
};

// POST /bookings/add-trip { date, name, note, startTime, harbour, hours, capacity, adultPrice, childPrice }:
// an extra trip on one day (a swim trip, a sunset trip) with its own seats, length and prices (pounds,
// as typed). Customers can book it online straight away, by the seat (never as a charter).
const addTrip = async (req, res) => {
    const { date, name, note = '', startTime, harbour = USUAL_HARBOUR, hours, capacity, adultPrice, childPrice } = req.body;
    if (!isDay(date)) return res.status(400).send({ ok: false, data: 'Please choose a valid date.' });
    if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME) return res.status(400).send({ ok: false, data: `Please give the trip a name (up to ${MAX_NAME} characters), e.g. Swim trip.` });
    if (typeof note !== 'string' || note.length > MAX_TRIP_NOTE) return res.status(400).send({ ok: false, data: `The note can be up to ${MAX_TRIP_NOTE} characters.` });
    const badTime = timeProblem(startTime);
    if (badTime) return res.status(400).send({ ok: false, data: badTime });
    if (typeof harbour !== 'string' || !Object.hasOwn(HARBOURS, harbour)) return res.status(400).send({ ok: false, data: 'Please choose a harbour.' });
    const length = Number(hours);
    if ((typeof hours !== 'string' && typeof hours !== 'number') || !Number.isFinite(length) || length < MIN_HOURS || length > MAX_HOURS || (length * 4) % 1) {
        return res.status(400).send({ ok: false, data: `Please give the trip's length in hours, from ${MIN_HOURS} to ${MAX_HOURS} (e.g. 1.5).` });
    }
    const seats = Number(capacity);
    if ((typeof capacity !== 'string' && typeof capacity !== 'number') || !/^\d+$/.test(String(capacity).trim()) || seats < 1 || seats > MAX_CAPACITY) {
        return res.status(400).send({ ok: false, data: `Please give the number of seats, from 1 to ${MAX_CAPACITY}.` });
    }
    const adult = toPence(adultPrice);
    const child = toPence(childPrice);
    if (adult === null || child === null) return res.status(400).send({ ok: false, data: 'Please enter the adult and child prices in pounds, e.g. 45 or 32.50.' });

    const trip = describeTrip(date, 'x000000', { extra: true, name: name.trim(), startTime, harbour });
    if (trip.startsAt <= new Date()) return res.send({ ok: false, data: `${trip.time} on ${showDay(date)} has already passed. Please choose a later time.` });

    const row = await Availability.create({
        date, timeslot: newExtraTimeslot(), extra: true, name: name.trim(), note: note.trim() || undefined, startTime,
        ...(harbour !== USUAL_HARBOUR && { harbour }), hours: length, capacity: seats, prices: { adult, child },
    });
    const added = describeTrip(date, row.timeslot, row);
    const clash = (await getTripsForDay(date)).find((other) => other.timeslot !== added.timeslot &&
        Math.abs(other.startsAt.getTime() - added.startsAt.getTime()) < Math.max(HOURS.trip, length) * 3600000);
    res.send({
        ok: true,
        data: `${added.name} added on ${showDay(date)} at ${added.time} from the ${added.harbour.name}: ${seats} seats, ${length} hours, £${pounds(adult)} adults, £${pounds(child)} children. Customers can book it now.${clash ? ` It overlaps the ${clash.named}.` : ''}`,
    });
};

// POST /bookings/remove-trip { date, timeslot }: deletes an extra trip. Not while anyone is booked on
// it (cancel it with "Cancel a whole trip" first, which emails them). If it has cancelled bookings it
// is only hidden, so those bookings still show which trip they were.
const removeTrip = async (req, res) => {
    const { date, timeslot } = req.body;
    if (!isDay(date) || !isTimeslot(timeslot)) return res.status(400).send({ ok: false, data: 'Please choose which trip.' });
    const trip = await findTrip(date, timeslot);
    if (!trip || !trip.extra) return res.status(400).send({ ok: false, data: 'Only an extra trip can be deleted.' });

    const active = await Bookings.countDocuments({ date, timeslot, status: { $ne: 'cancelled' } });
    if (active) {
        return res.send({ ok: false, data: `${trip.label} has ${active} booking${active === 1 ? '' : 's'}. Cancel the trip first ("Cancel a whole trip" emails everyone), then delete it.` });
    }
    if (await Bookings.exists({ date, timeslot })) await Availability.updateOne({ date, timeslot }, { $set: { removed: true, capacity: 0 } });
    else await Availability.deleteOne({ date, timeslot });
    res.send({ ok: true, data: `${trip.label} on ${showDay(date)} deleted. Customers can no longer see it.` });
};

module.exports = { dayTrips, changeTrip, messageTrip, addTrip, removeTrip, EARLIEST, LATEST };
