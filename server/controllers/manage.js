// "Manage my booking" (spec P2-6): the page a customer reaches from the link in their emails. The long
// random code in the link (utils/bookingCodes.js) is all it takes, so there is no login. What they can
// do and until when is in utils/manage.js. Every change is saved first, then emailed to the customer
// and the owner with trySend (a failed email never undoes a saved change).
const Bookings = require('../models/bookings');
const { getAvailability, withTripLock } = require('../utils/availability');
const { partyProblem, MAX_CAPACITY } = require('../utils/validateBooking');
const { isManageToken } = require('../utils/bookingCodes');
const { whatCanChange, freeUntil, momentText, changeablePayment } = require('../utils/manage');
const { bookingValue } = require('../utils/prices');
const { getTrip, withTrip } = require('../utils/trips');
const { seatsFor, partyText } = require('../utils/party');
const { longDay } = require('../utils/dates');
const { sendEmail, trySend } = require('../utils/mailer');
const emails = require('../emails');

const NOT_FOUND = "We couldn't find that booking. Please check the link in your email, or contact us.";
const MAX_MESSAGE = 1000;

// Why the customer can't change it themselves, in words (the page then shows how to get in touch)
const WHY = {
    cancelled: 'This booking has been cancelled.',
    started: 'This trip has already started, so the booking can no longer be changed online.',
    paid: 'This booking has been paid, so please contact us to change it.',
    deadline: 'It is too late to change or cancel this booking online.',
};

const findByToken = (token) => (isManageToken(token) ? Bookings.findOne({ manageToken: token }) : null);

// The booking as the page shows it. Never the token, the Stripe ids or anything about other bookings,
// apart from how many seats this booking could grow to.
const describe = async (booking) => {
    const trip = await getTrip(booking.date, booking.timeslot);
    const { canChange, why } = whatCanChange(booking, trip);
    const until = freeUntil(booking, trip);
    const charter = booking.charter === 'true';
    const prices = booking.prices || {};
    return {
        reference: booking.reference,
        firstName: booking.firstName || '',
        date: booking.date,
        day: longDay(booking.date),
        time: trip.time,
        tripName: trip.extra ? trip.name : null,
        tripNote: trip.note || null,
        harbour: { name: trip.harbour.name, map: trip.harbour.map },
        charter,
        adults: Number(booking.adults) || 0,
        children: Number(booking.children) || 0,
        infants: Number(booking.infants) || 0,
        party: partyText(booking),
        cancelled: booking.status === 'cancelled',
        paymentStatus: booking.paymentStatus || 'unpaid',
        cardLabel: booking.cardLabel || null,
        amount: bookingValue(booking, null), // pence, or null if the booking has no prices saved
        prices: { adult: prices.adult ?? null, child: prices.child ?? null, charter: prices.charter ?? null },
        freeUntil: until ? momentText(until) : null,
        canChange,
        why: why && WHY[why],
        // The most people this booking could have: a charter has the boat, anyone else what is left plus their own seats
        maxSeats: canChange ? (charter ? MAX_CAPACITY : Math.min(MAX_CAPACITY, await getAvailability(booking.date, booking.timeslot, booking._id))) : null,
    };
};

// GET /bookings/manage/:token
const view = async (req, res) => {
    const booking = await findByToken(req.params.token);
    if (!booking) return res.status(404).json({ ok: false, data: NOT_FOUND });
    res.json({ ok: true, booking: await describe(booking) });
};

// POST /bookings/manage/:token/cancel: free, up to the deadline. The card is then never charged.
const cancel = async (req, res) => {
    const booking = await findByToken(req.params.token);
    if (!booking) return res.status(404).json({ ok: false, data: NOT_FOUND });
    const { canChange, why } = whatCanChange(booking, await getTrip(booking.date, booking.timeslot));
    if (!canChange) return res.status(409).json({ ok: false, data: WHY[why] });

    // In one step that only works while it is still active and unpaid, so it can't race the card charge
    const cancelled = await Bookings.findOneAndUpdate(
        { _id: booking._id, status: { $ne: 'cancelled' }, ...changeablePayment },
        { $set: { status: 'cancelled', cancelledAt: new Date() } },
        { new: true }
    );
    if (!cancelled) return res.status(409).json({ ok: false, data: 'This booking has just changed. Please reload the page.' });

    const forEmail = await withTrip(cancelled);
    const emailed = cancelled.email ? await trySend(emails.cancellationEmail(forEmail)) : false;
    await trySend(emails.cancelledOwnerEmail(forEmail, { byCustomer: true }));
    res.json({
        ok: true,
        data: `Your booking has been cancelled and your card won't be charged.${emailed ? " We've emailed you to confirm." : ''}`,
        booking: await describe(cancelled),
    });
};

// POST /bookings/manage/:token/party with adults, children and infants: more people need the seats
const changeParty = async (req, res) => {
    const problem = partyProblem(req.body, { adultsRequired: true });
    if (problem) return res.status(400).json({ ok: false, data: problem });
    const party = { adults: Number(req.body.adults), children: Number(req.body.children) || 0, infants: Number(req.body.infants) || 0 };

    const found = await findByToken(req.params.token);
    if (!found) return res.status(404).json({ ok: false, data: NOT_FOUND });

    // Checked and saved inside the trip's lock, so nobody else can take the seats meanwhile
    const result = await withTripLock(found.date, found.timeslot, async () => {
        const booking = await Bookings.findById(found._id); // as it is now
        if (booking.date !== found.date || booking.timeslot !== found.timeslot) return { status: 409, data: 'This booking has just changed. Please reload the page.' };
        const { canChange, why } = whatCanChange(booking, await getTrip(booking.date, booking.timeslot));
        if (!canChange) return { status: 409, data: WHY[why] };

        const before = partyText(booking);
        if (['adults', 'children', 'infants'].every((key) => (Number(booking[key]) || 0) === party[key])) return { status: 200, ok: true, data: 'Nothing has changed.', booking };
        const seats = seatsFor(party);
        if (booking.charter === 'true') {
            if (seats > MAX_CAPACITY) return { status: 400, data: `A charter can take up to ${MAX_CAPACITY} people, infants included.` };
        } else if (seats > seatsFor(booking)) {
            const room = await getAvailability(booking.date, booking.timeslot, booking._id);
            if (room < seats) {
                return { status: 409, data: `Sorry, there's only room for ${Math.max(room, 0)} ${room === 1 ? 'person' : 'people'} on this trip now (infants take a seat too). Please choose fewer, or contact us.` };
            }
        }
        const saved = await Bookings.findOneAndUpdate(
            { _id: booking._id, status: { $ne: 'cancelled' }, ...changeablePayment },
            { $set: party },
            { new: true }
        );
        if (!saved) return { status: 409, data: 'This booking has just changed. Please reload the page.' };
        return { status: 200, ok: true, saved, before };
    });
    if (!result.ok) return res.status(result.status).json({ ok: false, data: result.data });
    if (!result.saved) return res.json({ ok: true, data: result.data, booking: await describe(result.booking) });

    const { saved, before } = result;
    const forEmail = await withTrip(saved);
    const amount = bookingValue(saved, null);
    const emailed = saved.email ? await trySend(emails.updatedEmail(forEmail, { amount })) : false;
    await trySend(emails.updatedOwnerEmail(forEmail, { change: `Party changed online by the customer: was ${before}, now ${partyText(saved)}.` }));
    res.json({
        ok: true,
        data: `Your booking is now for ${partyText(saved)}.${emailed ? " We've emailed you the details." : ''}`,
        booking: await describe(saved),
    });
};

// POST /bookings/manage/:token/message: emailed to the owner, who replies by email or makes the change
const message = async (req, res) => {
    const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!text) return res.status(400).json({ ok: false, data: 'Please write your message.' });
    if (text.length > MAX_MESSAGE) return res.status(400).json({ ok: false, data: `Please keep your message to ${MAX_MESSAGE} characters.` });

    const booking = await findByToken(req.params.token);
    if (!booking) return res.status(404).json({ ok: false, data: NOT_FOUND });

    // Nothing is saved, so a failed email is simply reported
    try {
        await sendEmail(emails.customerMessageOwnerEmail(await withTrip(booking), text));
    } catch {
        return res.status(502).json({ ok: false, data: "Sorry, your message couldn't be sent. Please email or phone us instead." });
    }
    res.json({ ok: true, data: "Thank you, your message has been sent. We'll get back to you soon." });
};

module.exports = { view, cancel, changeParty, message };
