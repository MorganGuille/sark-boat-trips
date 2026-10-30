// Online bookings (paymentsspec.md). Every customer booking, an ordinary trip or a private charter,
// saves a card on Stripe's own page ("setup" mode: nothing is charged), and the booking is only
// created once Stripe confirms the card is saved. The card is charged later, at the trip time.
const Bookings = require('../models/bookings');
const { getAvailability, isSlotEmpty } = require('../utils/availability');
const { validatePublicBooking } = require('../utils/validateBooking');
const { showDay } = require('../utils/dates');
const { readPrices, bookingValue } = require('../utils/prices');
const { settings } = require('../utils/settings');
const { trySend } = require('../utils/mailer');
const { seatsFor, partyText } = require('../utils/party');
const { safeHtml } = require('../utils/safeHtml');
const { buildConfirmationEmail, newBookingAdminEmail, cardPaymentLine } = require('./bookings');
const { charterConfirmationEmail, charterAdminEmail } = require('./charters');

// With no usable key the placeholder is only there so webhooks can still be verified (that needs
// the signing secret, not a key). Nothing else calls Stripe while settings.stripe.problem is set.
const stripe = require('stripe')(settings.stripe.key || 'sk_test_not_configured');

const UNAVAILABLE = "Online booking isn't available right now. Please call or email us to book.";
const FULL_NOTE = 'Not booked: the trip filled up while they were entering their card. Nothing was charged.';
const FIELDS = ['date', 'timeslot', 'firstName', 'lastName', 'phone', 'email', 'adults', 'children', 'infants', 'accommodation', 'message'];

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;

// The booking travels through Stripe as metadata. Stripe allows 500 characters per value, so the
// message (up to 1000) is split in two. kind ('trip' or 'charter') marks the session as ours and is
// set by the route, never by the customer.
const forStripe = (value) => String(value ?? '').slice(0, 500);
const toMetadata = (details, kind) => ({
    kind,
    ...Object.fromEntries(FIELDS.filter((key) => key !== 'message').map((key) => [key, forStripe(details[key])])),
    message: forStripe(details.message),
    message2: forStripe(String(details.message ?? '').slice(500)),
});
const fromMetadata = (metadata) => ({
    date: metadata.date,
    timeslot: metadata.timeslot,
    firstName: metadata.firstName,
    lastName: metadata.lastName,
    phone: metadata.phone,
    email: metadata.email,
    adults: Number(metadata.adults) || 0,
    children: Number(metadata.children) || 0,
    infants: Number(metadata.infants) || 0,
    accommodation: metadata.accommodation,
    message: `${metadata.message || ''}${metadata.message2 || ''}`,
    charter: metadata.kind === 'charter' ? 'true' : 'false',
});
const isOurs = (session) => Boolean(session) && session.mode === 'setup' && ['trip', 'charter'].includes(session.metadata?.kind);

// A charter needs the whole trip; anyone else needs enough seats left
const hasRoom = async (booking) => booking.charter === 'true'
    ? isSlotEmpty(booking.date, booking.timeslot)
    : (await getAvailability(booking.date, booking.timeslot)) >= seatsFor(booking);

const what = (booking) => (booking.charter === 'true' ? 'charter' : 'trip');

// "Visa •••• 4242 (expires 08/28)", shown on the dashboard
const describeCard = (paymentMethod) => {
    const card = paymentMethod?.card;
    if (!card) return undefined;
    const brand = String(card.brand || 'card').replace(/^./, (c) => c.toUpperCase());
    return `${brand} •••• ${card.last4} (expires ${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)})`;
};

// Starts a booking: checks it, then sends the customer to Stripe to save a card
const startCheckout = (kind) => async (req, res) => {
    if (settings.stripe.problem) {
        console.error('Online booking refused:', settings.stripe.problem);
        return res.status(503).json({ ok: false, data: UNAVAILABLE });
    }

    const details = Object.fromEntries(FIELDS.map((key) => [key, req.body[key]]));
    const problem = await validatePublicBooking(details);
    if (problem) {
        return res.status(400).json({ ok: false, data: problem });
    }

    const prices = await readPrices();
    if (!prices) {
        console.error('Online booking refused: the prices have not been set on the dashboard');
        return res.status(503).json({ ok: false, data: UNAVAILABLE });
    }

    const booking = fromMetadata(toMetadata(details, kind));
    if (!(await hasRoom(booking))) {
        return res.send({ ok: false, data: `No spaces available at ${booking.timeslot} on ${showDay(booking.date)}!` });
    }

    const amount = bookingValue(booking, prices);
    try {
        const customer = await stripe.customers.create({
            email: booking.email, name: `${booking.firstName} ${booking.lastName}`, phone: booking.phone,
        });
        const session = await stripe.checkout.sessions.create({
            mode: 'setup',
            currency: 'gbp',
            customer: customer.id,
            success_url: `${settings.publicUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${settings.publicUrl}/canceled`,
            metadata: toMetadata(details, kind),
            setup_intent_data: { description: `Sark Boat Trips ${what(booking)} ${booking.timeslot} ${showDay(booking.date)}` },
            custom_text: {
                submit: {
                    message: `Your card won't be charged now. ${pounds(amount)} will be charged at ${booking.timeslot} on ${showDay(booking.date)}, when your ${what(booking)} starts. If we cancel because of the weather, you won't be charged.`,
                },
            },
        });
        res.json({ ok: true, url: session.url });
    } catch (error) {
        // Stripe or the database failed: tell the customer, and keep the server running
        console.error('Error creating checkout session:', error);
        res.status(502).json({ ok: false, data: "We couldn't open the card page. Nothing has been booked or charged. Please try again, or contact us to book." });
    }
};

const tripFullCustomerEmail = (booking) => ({
    from: 'sarkboattrips@gmail.com',
    to: booking.email,
    subject: 'Sorry, your trip filled up - Sark Boat Trips',
    html: safeHtml`<div style="font-family: sans-serif; max-width: 30rem;">
        <h3>Dear ${booking.firstName},</h3>
        <p>While you were entering your card, the last places on the ${booking.timeslot} ${what(booking)} on ${showDay(booking.date)} were taken, so we couldn't book you.</p>
        <p><strong>Nothing has been charged.</strong></p>
        <p>Please choose another trip on our website, or get in touch and we'll do our best to fit you in.</p>
        <p>Sark Boat Trips<br>+44 7911 764 246<br>sarkboattrips@gmail.com</p>
    </div>`,
});

// Plain text on purpose: this one is for the owner and needs no layout
const tripFullOwnerEmail = (booking) => ({
    from: 'sarkboattrips@gmail.com',
    to: 'sarkboattrips@gmail.com',
    subject: `Booking NOT made: the ${booking.timeslot} ${what(booking)} on ${showDay(booking.date)} filled up`,
    text: `A customer saved their card, but by then the ${booking.timeslot} ${what(booking)} on ${showDay(booking.date)} had no room left, so the booking was not made and nothing was charged. They have been emailed.

It is on the dashboard as a cancelled booking (Show cancelled). If room frees up you can restore it, and their card will then be charged at the trip time.

Name: ${booking.firstName} ${booking.lastName}
Party: ${partyText(booking)}
Email: ${booking.email}
Phone: ${booking.phone}`,
});

// Everything that follows a saved card. The Stripe webhook, a Stripe retry and the customer's
// /success page can all arrive for the same session, in any order, so this is safe to call
// repeatedly: the booking is keyed on the Stripe session id, and only the call that actually
// creates it sends the emails.
const fulfillCheckoutSession = async (session) => {
    const existing = await Bookings.findOne({ stripeSessionId: session.id });
    if (existing) return { booking: existing, created: false };

    const details = fromMetadata(session.metadata);
    const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent, { expand: ['payment_method'] });
    const card = setupIntent.payment_method;
    // Someone may have taken the last places while this customer was entering their card. Nothing
    // has been charged, so the trip is never overbooked: the booking is kept as cancelled, with the
    // reason, so the owner can see it and restore it if room frees up.
    const room = await hasRoom(details);
    const prices = await readPrices();

    let booking;
    try {
        booking = await Bookings.create({
            ...details,
            stripeSessionId: session.id,
            stripeCustomerId: session.customer,
            stripePaymentMethodId: typeof card === 'string' ? card : card?.id,
            cardLabel: describeCard(card),
            paymentStatus: 'card_saved',
            prices: prices || undefined,
            ...(!room && { status: 'cancelled', cancelledAt: new Date(), paymentNote: FULL_NOTE }),
        });
    } catch (error) {
        if (error.code === 11000) {
            // A parallel call created it between our check and our insert
            return { booking: await Bookings.findOne({ stripeSessionId: session.id }), created: false };
        }
        throw error;
    }

    // The booking is saved, so a failed email must not undo it
    if (room) {
        const line = cardPaymentLine(bookingValue(booking, prices), details.timeslot);
        const party = partyText(details);
        const [toCustomer, toOwner] = details.charter === 'true'
            ? [charterConfirmationEmail(details, line), charterAdminEmail(details)]
            : [buildConfirmationEmail({ ...details, party, paymentLine: line }), newBookingAdminEmail({ ...details, party })];
        if (!(await trySend(toCustomer))) toOwner.subject += ' (CUSTOMER EMAIL FAILED, please contact them)';
        await trySend(toOwner);
    } else {
        await trySend(tripFullCustomerEmail(details));
        await trySend(tripFullOwnerEmail(details));
    }

    return { booking, created: true };
};

// Called by Stripe itself when a checkout completes, so the booking exists even if the customer
// never makes it back to the /success page. It is mounted in app.js, before express.json(),
// because verifying the signature needs the raw request body.
const webhook = async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set, cannot accept Stripe webhooks');
        return res.status(503).send('Webhook not configured');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
    } catch (error) {
        console.error('Stripe webhook signature check failed:', error.message);
        return res.status(400).send('Invalid signature');
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (isOurs(session) && session.status === 'complete') {
            // If this throws (e.g. the database is down) Stripe gets a 500 and retries later
            await fulfillCheckoutSession(session);
        }
    }

    res.json({ received: true });
};

// The /success page asks this once the customer comes back from Stripe. It uses the same
// fulfilment as the webhook, so it works whichever of the two gets there first (and when no
// webhook is configured yet, e.g. when testing locally). It always sends exactly one response.
const verifyPayment = async (req, res) => {
    if (settings.stripe.problem) {
        console.error('Booking check refused:', settings.stripe.problem);
        return res.status(503).json({ ok: false, message: UNAVAILABLE });
    }

    const { session_id } = req.query;
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
        return res.status(400).json({ ok: false, message: 'Missing or invalid booking session' });
    }

    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (error) {
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(404).json({ ok: false, message: 'Booking not found' });
        }
        throw error;
    }
    if (!isOurs(session)) {
        return res.status(404).json({ ok: false, message: 'Booking not found' });
    }
    if (session.status !== 'complete') {
        return res.json({ ok: false, message: 'Your card was not saved, so nothing has been booked.' });
    }

    const { booking } = await fulfillCheckoutSession(session);
    const active = booking.status !== 'cancelled';
    res.json({
        ok: active,
        message: active ? 'Card saved and booking confirmed' : booking.paymentNote || 'This booking is no longer active. Please contact us.',
        name: booking.firstName,
        date: booking.date,
        timeslot: booking.timeslot,
        charter: booking.charter === 'true',
        amount: bookingValue(booking, null),
        cardLabel: booking.cardLabel,
    });
};

module.exports = { startCheckout, fulfillCheckoutSession, webhook, verifyPayment };
