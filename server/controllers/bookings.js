const mongoose = require('mongoose');
const Bookings = require("../models/bookings");
const Availability = require('../models/availability');
const { sendEmail, trySend } = require('../utils/mailer');
const { getAvailability, isSlotEmpty, withTripLock, noRoomMessage } = require('../utils/availability');
const { isDay, showDay } = require('../utils/dates');
const { readPrices, bookingValue, pricesFor } = require('../utils/prices');
const { seatsFor, partyText } = require('../utils/party');
const emails = require('../emails');
const { withTrip, withTrips, getTrip, findTrip, getTripsForDay, tripsFor, tripOfBooking } = require('../utils/trips');
const { isMonth, monthRange, buildReport, toCsv } = require('../utils/report');
const { validatePublicBooking, validateAdminBooking, validateAvailabilitySetting, guernseyToday } = require('../utils/validateBooking');


const updateAvailability = async (req, res) => {
    const { date, timeslot, capacity } = req.body;

    const problem = validateAvailabilitySetting(req.body);
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }
    const trip = await findTrip(date, timeslot);
    if (!trip) {
        return res.status(400).send({ ok: false, data: 'That trip is not running on that day.' });
    }

    try {
        let availability = await Availability.findOneAndUpdate(
            { date, timeslot },
            { capacity },
            { upsert: true, new: true }
        );

        res.send({ ok: true, data: `Sucessfully updated availability, there are now ${availability.capacity} seats on the ${trip.named}` });
    } catch (error) {
        console.error("Error updating availability:", error);
        res.status(500).send({ ok: false, data: "An error occurred while updating availability." });
    }
};


const isBlank = (value) => value == null || String(value).trim() === '';

const bookingName = (booking) => [booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'this booking';

// What each booking is worth (pence, or null if no prices are known), so the dashboard can show what to
// collect, and its trip's time and name that day (tripLabel: '3pm', 'Swim trip (4:30pm)'; tripStart:
// '16:30', for putting the day's trips in order)
const withAmountDue = async (bookings, prices) => {
    const trips = await tripsFor(bookings);
    return bookings.map((b) => {
        const trip = tripOfBooking(trips, b);
        return { ...b.toObject(), amountDue: bookingValue(b, prices), tripLabel: trip?.label || b.timeslot, tripStart: trip?.startTime || '' };
    });
};

// How dashboard messages name a booking's trip: '11am', or 'Swim trip (4:30pm)' for an extra trip
const labelOf = async (booking) => (await getTrip(booking.date, booking.timeslot)).label;

// An extra trip is only sold by the seat (owner's decision)
const NO_EXTRA_CHARTER = "Extra trips can't be booked as a private charter. Choose the 11am or 2pm trip.";

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;

// Day view and search hide cancelled bookings unless asked (?includeCancelled=true)
const statusFilter = (req) => req.query.includeCancelled === 'true' ? {} : { status: { $ne: 'cancelled' } };

// Dashboard only (behind requireAuth): the owner may need to save a booking with missing details
const adminAddBooking = async (req, res) => {
    const { date, timeslot, firstName, lastName, phone, email, accommodation, message, charter } = req.body;
    const adults = Number(req.body.adults) || 0;
    const children = Number(req.body.children) || 0;
    const infants = Number(req.body.infants) || 0;

    const problem = validateAdminBooking(req.body, { requireTrip: true });
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }

    try {
        const trip = await findTrip(date, timeslot);
        if (!trip) return res.status(400).send({ ok: false, data: 'That trip is not running on that day.' });
        if (trip.extra && charter === 'true') return res.status(400).send({ ok: false, data: NO_EXTRA_CHARTER });
        // Checked and saved inside the trip's lock, so a customer booking at the same moment can't also take the seats
        let left;
        const saved = await withTripLock(date, timeslot, async () => {
            left = await getAvailability(date, timeslot);
            if (left < adults + children + infants) return null;
            // validateBeforeSave is off because the model requires the customer details
            return new Bookings({
                date, timeslot, firstName, lastName, phone, email, adults, children, infants, accommodation, message, charter,
                prices: pricesFor(trip, await readPrices()) || undefined,
            }).save({ validateBeforeSave: false });
        });
        if (!saved) {
            return res.send({ ok: false, data: noRoomMessage({ trip, date, left, booking: { adults, children, infants }, owner: true }) });
        }

        const who = [firstName, lastName].filter(Boolean).join(' ') || 'the booking';
        if (email) {
            const sent = await trySend(emails.confirmationEmail(await withTrip(saved)));
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(date)} at ${trip.label} saved${sent ? ' and confirmation email sent' : ', but the confirmation email could not be sent'}` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${showDay(date)} at ${trip.label} saved (no email address, so no confirmation was sent)` });
    } catch (error) {
        console.error(error);
        res.status(500).send({ ok: false, data: "An error occurred saving the booking." });
    }
};

const cancelBooking = async (req, res) => {
    const { _id } = req.body;

    try {
        const cancelledBooking = await Bookings.findOneAndUpdate(
            { _id, status: { $ne: 'cancelled' } },
            { $set: { status: 'cancelled', cancelledAt: new Date() } },
            { new: true }
        );

        if (!cancelledBooking) {
            return res.status(404).send({ ok: false, data: `No active booking found for booking ID : ${_id}` });
        }

        const forEmail = await withTrip(cancelledBooking);
        const mailOptionsClient = emails.cancellationEmail(forEmail);
        const mailOptionsAdmin = emails.cancelledOwnerEmail(forEmail);


        const who = bookingName(cancelledBooking);
        const at = forEmail.trip.label;
        try {
            if (cancelledBooking.email) await sendEmail(mailOptionsClient);
            await sendEmail(mailOptionsAdmin);
        } catch (emailError) {
            // The booking is already cancelled, so report that and flag the email problem
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(cancelledBooking.date)} at ${at} cancelled, but the email could not be sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${showDay(cancelledBooking.date)} at ${at} cancelled${cancelledBooking.email ? ' and email sent' : ''}` });

    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const restoreBooking = async (req, res) => {
    const { _id } = req.body;

    try {
        const booking = await Bookings.findOne({ _id, status: 'cancelled' });
        if (!booking) {
            return res.status(404).send({ ok: false, data: "No cancelled booking found with that ID." });
        }

        const trip = await findTrip(booking.date, booking.timeslot);
        if (!trip) {
            return res.send({ ok: false, data: `Can't restore: the trip this booking was on (${await labelOf(booking)}) no longer runs on ${showDay(booking.date)}. Make a new booking instead.` });
        }
        const at = trip.label;
        // Checked and saved inside the trip's lock, so a customer booking at the same moment can't also take the seats
        const refused = await withTripLock(booking.date, booking.timeslot, async () => {
            if (booking.charter === 'true' && !(await isSlotEmpty(booking.date, booking.timeslot))) {
                return `Can't restore this charter: the ${trip.named} on ${showDay(booking.date)} already has other bookings (or is closed).`;
            }
            const availability = await getAvailability(booking.date, booking.timeslot);
            if (availability < seatsFor(booking)) {
                return `Can't restore: only ${availability} spaces left at ${at} on ${showDay(booking.date)}.`;
            }
            booking.status = 'active';
            booking.cancelledAt = undefined;
            // validateBeforeSave is off because bookings made on the dashboard may be incomplete
            await booking.save({ validateBeforeSave: false });
            return null;
        });
        if (refused) return res.send({ ok: false, data: refused });

        const who = bookingName(booking);
        if (!booking.email) {
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(booking.date)} at ${at} restored (no email address, so no confirmation was sent)` });
        }
        try {
            await sendEmail(emails.confirmationEmail(await withTrip(booking), bookingValue(booking, await readPrices())));
        } catch (emailError) {
            return res.send({ ok: true, data: `Booking for ${who} on ${showDay(booking.date)} at ${at} restored, but the confirmation email could not be sent` });
        }
        res.send({ ok: true, data: `Booking for ${who} on ${showDay(booking.date)} at ${at} restored and confirmation email sent` });
    } catch (error) {
        console.error("Error restoring booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

// Only cancelled bookings can be removed for good, e.g. when a customer asks for their data to be erased
const permanentlyDeleteBooking = async (req, res) => {
    const { _id } = req.body;

    try {
        const deleted = await Bookings.findOneAndDelete({ _id, status: 'cancelled' });
        if (!deleted) {
            return res.status(404).send({ ok: false, data: "Only cancelled bookings can be permanently deleted." });
        }
        res.send({ ok: true, data: `Booking for ${bookingName(deleted)} on ${showDay(deleted.date)} at ${await labelOf(deleted)} permanently deleted` });
    } catch (error) {
        console.error("Error permanently deleting booking:", error);
        res.status(500).send({ ok: false, data: "An error occurred. Please try again later." });
    }
};

const checkDate = async (req, res) => {
    let date = req.params.date
    if (!isDay(date)) {
        return res.status(400).send({ ok: false, data: "Invalid date." })
    }
    try {

        let bookings = await Bookings.find({ date: date, ...statusFilter(req) })
        res.send({ ok: true, data: await withAmountDue(bookings, await readPrices()) })
    }
    catch (error) {
        res.send({ ok: false, data: "check console for errors" })
        console.log(error)
    }
}

const checkMonthAvail = async (req, res) => {
    const { dates } = req.body;

    // The calendar asks for one month (at most 31 days) at a time
    const valid = Array.isArray(dates) && dates.length > 0 && dates.length <= 31 &&
        dates.every(isDay);
    if (!valid) {
        return res.status(400).send({ ok: false, data: "Invalid dates." });
    }

    try {
        const availabilityData = await Promise.all(
            dates.map(async (date) => {
                try {
                    // The usual trips by name, and the extra trips that day (seats left on each)
                    const extras = (await getTripsForDay(date)).filter((trip) => trip.extra);
                    return {
                        '11am': await getAvailability(date, '11am'),
                        '2pm': await getAvailability(date, '2pm'),
                        ...(extras.length && { extras: await Promise.all(extras.map(async (trip) => ({ timeslot: trip.timeslot, spaces: await getAvailability(date, trip.timeslot) }))) }),
                    };
                } catch (error) {
                    console.error(`Error fetching availability for ${showDay(date)}:`, error);
                    return null;
                }
            })
        );

        res.send({ ok: true, data: availabilityData });
    } catch (error) {
        console.error("Error fetching batch availability:", error);
        res.status(500).send({ ok: false, data: "An error occurred." });
    }
};


// ---------- Search and the upcoming list (spec P2-3) ----------

// Matched literally, never as a pattern (what the owner types could otherwise be a slow or broken regex)
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Typed like a phone number: only digits, spaces, +, brackets and dashes, with at least 4 digits
const looksLikePhone = (text) => /^[\d\s+()-]+$/.test(text) && text.replace(/\D/g, '').length >= 4;

// What to look for: a phone number in the phone field whatever its spaces, and with or without +44 or the
// leading 0 (07700 900123 finds +44 7700 900123); otherwise a booking reference (SBT-7K3F9Q, with or
// without the SBT-), or every word in the first name, last name or email (Ann Smith, smith@, ann)
const searchFilter = (text) => {
    if (looksLikePhone(text)) {
        const digits = text.replace(/\D/g, '').replace(/^(44|0)/, '');
        return { phone: { $regex: digits.split('').join('\\D*') } };
    }
    const reference = text.toUpperCase().replace(/\s/g, '').replace(/^(SBT-?)?/, 'SBT-');
    const words = text.split(/\s+/).filter(Boolean);
    const inDetails = words.map((word) => ({
        $or: ['firstName', 'lastName', 'email'].map((field) => ({ [field]: { $regex: escapeRegex(word), $options: 'i' } })),
    }));
    return { $or: [{ reference }, { $and: inDetails }] };
};

const MAX_RESULTS = 500;

// The bookings found, in date and trip order, as the day view sends them
const sendList = async (res, filter) => {
    const bookings = await Bookings.find(filter).sort({ date: 1 }).limit(MAX_RESULTS);
    const list = await withAmountDue(bookings, await readPrices());
    list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.tripStart || '').localeCompare(b.tripStart || ''));
    res.send({ ok: true, data: list, more: bookings.length === MAX_RESULTS });
};

// GET /bookings/search?q=...&from=YYYY-MM-DD&to=YYYY-MM-DD: either or both; no dates means every booking, past and future
const search = async (req, res) => {
    const text = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const { from, to } = req.query;
    if (!text && !from && !to) {
        return res.status(400).send({ ok: false, data: 'Type a name, email, phone or reference, or pick dates.' });
    }
    if ((from && !isDay(from)) || (to && !isDay(to))) {
        return res.status(400).send({ ok: false, data: 'Invalid date.' });
    }
    if (from && to && from > to) { // YYYY-MM-DD text sorts in date order
        return res.status(400).send({ ok: false, data: 'The "from" date is after the "to" date.' });
    }
    const dates = from || to ? { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};
    await sendList(res, { ...(text && searchFilter(text)), ...dates, ...statusFilter(req) });
};

// The old address, /bookings/search/<text>: the same search without dates
const searchByPath = (req, res) => search({ ...req, query: { ...req.query, q: req.params.search } }, res);

// 'YYYY-MM-DD' plus n days
const addDays = (day, n) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
};

// GET /bookings/upcoming?days=7|14|30|all: every booking from today (Guernsey time) for that many days, today included
const UPCOMING_DAYS = ['7', '14', '30', 'all'];
const upcoming = async (req, res) => {
    const days = String(req.query.days ?? '7');
    if (!UPCOMING_DAYS.includes(days)) {
        return res.status(400).send({ ok: false, data: 'Choose 7, 14 or 30 days, or all.' });
    }
    const today = guernseyToday();
    const date = { $gte: today, ...(days !== 'all' && { $lt: addDays(today, Number(days)) }) };
    await sendList(res, { date, ...statusFilter(req) });
};


// Text details the dashboard can edit. Sent empty, one is cleared; left out, it stays as it is.
const EDITABLE_TEXT = ['firstName', 'lastName', 'phone', 'email', 'accommodation', 'message'];


const updateBooking = async (req, res) => {
    const problem = validateAdminBooking(req.body);
    if (problem) {
        return res.status(400).send({ ok: false, data: problem });
    }

    const { id } = req.params;
    const booking = mongoose.isValidObjectId(id) ? await Bookings.findById(id) : null;
    if (!booking) {
        return res.status(404).send({ ok: false, data: 'Booking not found!' });
    }
    if (booking.status === 'cancelled') {
        return res.status(409).send({ ok: false, data: 'This booking is cancelled. Restore it before editing.' });
    }

    const before = { date: booking.date, timeslot: booking.timeslot, seats: seatsFor(booking), charter: booking.charter };

    // The date, timeslot and booking type can be changed but never blanked
    for (const key of ['date', 'timeslot', 'charter']) {
        if (!isBlank(req.body[key])) booking[key] = req.body[key];
    }
    for (const key of EDITABLE_TEXT) {
        if (req.body[key] !== undefined) booking[key] = isBlank(req.body[key]) ? undefined : req.body[key].trim();
    }
    // Party size drives the seat counts, so a blank adults box leaves the number alone rather than
    // silently freeing the seats. A blank children or infants box means none.
    if (!isBlank(req.body.adults)) booking.adults = Number(req.body.adults);
    if (req.body.children !== undefined) booking.children = isBlank(req.body.children) ? 0 : Number(req.body.children);
    if (req.body.infants !== undefined) booking.infants = isBlank(req.body.infants) ? 0 : Number(req.body.infants);

    if (!booking.isModified()) {
        return res.send({ ok: true, data: 'No changes to save.' });
    }

    const moved = booking.date !== before.date || booking.timeslot !== before.timeslot;
    const newTrip = await findTrip(booking.date, booking.timeslot);
    if (moved && !newTrip) {
        return res.status(400).send({ ok: false, data: `Can't make that change: that trip is not running on ${showDay(booking.date)}.` });
    }
    if (booking.charter === 'true' && newTrip?.extra) {
        return res.status(400).send({ ok: false, data: NO_EXTRA_CHARTER });
    }

    // Moving a booking, adding people, or making it a charter must still fit. (Taking people away
    // or editing contact details never needs room, so a trip that is already over-full can still be edited.)
    const needsRoom = booking.date !== before.date || booking.timeslot !== before.timeslot ||
        seatsFor(booking) > before.seats || (booking.charter === 'true' && before.charter !== 'true');
    const roomProblem = async () => {
        const trip = `the ${newTrip?.named || `${booking.timeslot} trip`} on ${showDay(booking.date)}`;
        if (booking.charter === 'true') {
            if (!(await isSlotEmpty(booking.date, booking.timeslot, booking._id))) {
                return `Can't make that change: ${trip} already has other bookings (or is closed), and a charter needs the whole trip.`;
            }
        } else {
            const left = await getAvailability(booking.date, booking.timeslot, booking._id);
            if (left < seatsFor(booking)) {
                return `Can't make that change: ${trip} has only ${Math.max(left, 0)} space${left === 1 ? '' : 's'} left. Raise the trip's capacity first if you want to fit more people in.`;
            }
        }
        return null;
    };

    // Moved onto or off an extra trip: it costs what the new trip costs (owner's decision). Between the
    // usual trips it keeps the prices it was booked at.
    if (moved) {
        const oldTrip = await getTrip(before.date, before.timeslot);
        if (oldTrip.extra || newTrip.extra) booking.prices = pricesFor(newTrip, await readPrices()) || undefined;
    }

    // Moved to another day: it gets a reminder the evening before the new day
    if (booking.date !== before.date) {
        booking.reminderSentAt = undefined;
        booking.reminderAttempts = undefined;
    }

    // Checked and saved inside the trip's lock, so a customer booking at the same moment can't also take the seats.
    // validateBeforeSave is off because bookings made on the dashboard may be missing details.
    const refused = await withTripLock(booking.date, booking.timeslot, async () => {
        const problem = needsRoom ? await roomProblem() : null;
        if (!problem) await booking.save({ validateBeforeSave: false });
        return problem;
    });
    if (refused) return res.send({ ok: false, data: refused });

    // The change is saved, so email problems are reported but never fail the request
    const notify = req.body.notifyCustomer !== false;
    const forEmail = await withTrip(booking);
    const customerEmailed = booking.email && notify ? await trySend(emails.updatedEmail(forEmail)) : null;
    await trySend(emails.updatedOwnerEmail(forEmail));

    let emailNote = '';
    if (booking.email && !notify) emailNote = ' (customer not emailed, as you asked)';
    else if (customerEmailed === true) emailNote = ' and email sent';
    else if (customerEmailed === false) emailNote = ', but the email to the customer could not be sent';
    res.send({ ok: true, data: `Booking for ${bookingName(booking)} on ${showDay(booking.date)} updated successfully${emailNote}` });
};

// Passenger and income totals for one month (?format=csv for a download). Dashboard only.
const monthlyReport = async (req, res) => {
    const { month } = req.params;
    if (!isMonth(month)) {
        return res.status(400).send({ ok: false, data: "Please choose a month." });
    }
    const { first, last } = monthRange(month);
    const bookings = await Bookings.find({ date: { $gte: first, $lte: last }, status: { $ne: 'cancelled' } });
    const report = buildReport(bookings, await readPrices());
    if (!report) {
        return res.status(409).send({ ok: false, data: "Set your adult, child and charter prices first, so the income can be worked out." });
    }
    if (req.query.format === 'csv') {
        res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="sark-boat-trips-${month}.csv"` });
        return res.send(toCsv(report));
    }
    res.send({ ok: true, month, days: report.days, total: report.total });
};

// The owner took the money on the day (cash or card reader). Also stops a saved card being charged.
const markPaid = async (req, res) => {
    const { _id } = req.body;
    if (!mongoose.isValidObjectId(_id)) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    const booking = await Bookings.findById(_id);
    if (!booking) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    if (booking.status === 'cancelled') return res.status(409).send({ ok: false, data: 'This booking is cancelled. Restore it before marking it paid.' });

    const amount = bookingValue(booking, await readPrices());
    // Only from unpaid or card saved, and in one step, so it can't race the card charge
    const updated = await Bookings.findOneAndUpdate(
        { _id, paymentStatus: { $in: ['unpaid', 'card_saved', null] } },
        { $set: { paymentStatus: 'paid_in_person', paidAt: new Date(), ...(amount !== null && { amountPaid: amount }) }, $unset: { paymentNote: '' } },
        { new: true }
    );
    if (!updated) {
        const now = booking.paymentStatus === 'charging' ? 'is being charged right now' : 'is already paid';
        return res.status(409).send({ ok: false, data: `This booking ${now}.` });
    }
    res.send({ ok: true, data: `${bookingName(updated)} on ${showDay(updated.date)} at ${await labelOf(updated)} marked as paid in person${amount !== null ? ` (${pounds(amount)})` : ''}` });
};

// Undoes "Mark paid" (a mis-tap). A booking with a saved card goes back to being charged at the trip time.
const markUnpaid = async (req, res) => {
    const { _id } = req.body;
    if (!mongoose.isValidObjectId(_id)) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    const booking = await Bookings.findById(_id);
    if (!booking) return res.status(404).send({ ok: false, data: 'Booking not found!' });
    if (booking.paymentStatus !== 'paid_in_person') {
        const why = booking.paymentStatus === 'paid' ? 'It was paid online: refund it in Stripe instead.' : 'It is not marked as paid in person.';
        return res.status(409).send({ ok: false, data: `Can't undo: ${why}` });
    }
    const back = booking.stripePaymentMethodId ? 'card_saved' : 'unpaid';
    const updated = await Bookings.findOneAndUpdate(
        { _id, paymentStatus: 'paid_in_person' },
        { $set: { paymentStatus: back }, $unset: { paidAt: '', amountPaid: '' } },
        { new: true }
    );
    if (!updated) return res.status(409).send({ ok: false, data: 'This booking changed in the meantime. Try again.' });
    res.send({ ok: true, data: `${bookingName(updated)} on ${showDay(updated.date)} at ${await labelOf(updated)} is ${back === 'card_saved' ? 'back to being charged to the saved card at the trip time' : 'marked as unpaid again'}` });
};

// Why the owner cancelled a whole trip, as the customer reads it
const TRIP_REASONS = { weather: ' because of the weather and sea conditions', other: '' };

// Cancels every booking on one trip (a weather day) and closes the trip to new bookings. Nobody's
// card is charged, because cancelled bookings never are. Each customer gets the cancellation email
// with an apology; the owner gets one summary instead of one email per booking.
const cancelTrip = async (req, res) => {
    const { date, timeslot, reason = 'weather' } = req.body;
    const problem = validateAvailabilitySetting({ date, timeslot, capacity: '0' });
    if (problem) return res.status(400).send({ ok: false, data: problem });
    if (typeof reason !== 'string' || !Object.hasOwn(TRIP_REASONS, reason)) return res.status(400).send({ ok: false, data: 'Please choose a reason.' });
    const tripNow = await findTrip(date, timeslot);
    if (!tripNow) return res.status(400).send({ ok: false, data: 'That trip is not running on that day.' });

    // Close it first, so nobody can book it while the bookings are being cancelled
    await Availability.findOneAndUpdate({ date, timeslot }, { capacity: 0 }, { upsert: true });

    const cancelled = [];
    for (const booking of await Bookings.find({ date, timeslot, status: { $ne: 'cancelled' } })) {
        const done = await Bookings.findOneAndUpdate(
            { _id: booking._id, status: { $ne: 'cancelled' } },
            { $set: { status: 'cancelled', cancelledAt: new Date() } },
            { new: true }
        );
        if (done) cancelled.push(done);
    }

    // Saved first, so emails are reported but never undo anything
    const notEmailed = [];
    let emailed = 0;
    for (const booking of await withTrips(cancelled)) {
        if (!booking.email) { notEmailed.push(booking); continue; }
        const what = booking.charter === 'true' ? 'charter' : 'trip';
        const apology = `We're very sorry: we've had to cancel this ${what}${TRIP_REASONS[reason]}. We'd love to take you out another day, so please book again or get in touch.`;
        if (await trySend(emails.cancellationEmail(booking, apology))) emailed++;
        else notEmailed.push(booking);
    }
    const toRefund = cancelled.filter((b) => ['paid', 'paid_in_person', 'charging'].includes(b.paymentStatus));

    const trip = `the ${tripNow.named} on ${showDay(date)}`;
    await trySend(emails.tripCancelledOwnerEmail({ date, time: tripNow.label, named: tripNow.named, reasonText: TRIP_REASONS[reason], cancelled, notEmailed, toRefund }));

    const parts = [`${cancelled.length} booking${cancelled.length === 1 ? '' : 's'} cancelled`, `${emailed} customer${emailed === 1 ? '' : 's'} emailed`];
    if (notEmailed.length) parts.push(`${notEmailed.length} not emailed (see your email)`);
    res.send({
        ok: true,
        data: `${trip.replace(/^the/, 'The')} is cancelled and closed to new bookings: ${parts.join(', ')}. Nobody will be charged.${toRefund.length ? ` ${toRefund.length} had already paid: refund them (see your email).` : ''}`,
    });
};

module.exports = { cancelTrip, markPaid, markUnpaid, monthlyReport, adminAddBooking, cancelBooking, restoreBooking, permanentlyDeleteBooking, checkDate, checkMonthAvail, search, searchByPath, upcoming, updateBooking, updateAvailability }

