const Bookings = require("../models/bookings");
const nodemailer = require('nodemailer');
const { isSlotEmpty } = require('../utils/availability');
const { safeHtml } = require('../utils/safeHtml');
const { validatePublicBooking } = require('../utils/validateBooking');
const { showDay } = require('../utils/dates');
const { settings } = require('../utils/settings');

// With no usable key the placeholder is only there so webhooks can still be verified (that needs
// the signing secret, not a key). Nothing else calls Stripe while settings.stripe.problem is set.
const stripe = require('stripe')(settings.stripe.key || 'sk_test_not_configured');

const paymentsOff = {
    data: "Charter payments aren't available right now. Please contact us to book your charter.",
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.gmail_address,
        pass: process.env.gmail_password,
    },
});

const sendEmail = async (mailOptions) => {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// ----------------


// Stripe allows at most 500 characters per metadata value
const forStripe = (value) => String(value ?? '').slice(0, 500);

const createCheckOutSession = async (req, res) => {
    if (settings.stripe.problem) {
        console.error('Charter checkout refused:', settings.stripe.problem);
        return res.status(503).json({ ok: false, ...paymentsOff });
    }

    const { ...newBooking } = req.body

    const problem = await validatePublicBooking(newBooking);
    if (problem) {
        return res.status(400).json({ ok: false, data: problem });
    }

    try {
        /// check for availability before sending to stripe ////

        // A charter needs the whole trip to itself
        if (!(await isSlotEmpty(newBooking.date, newBooking.timeslot))) {
            return res.send({ ok: false, data: `No spaces available at ${newBooking.timeslot} on ${showDay(newBooking.date)}!` });
        }

        const session = await stripe.checkout.sessions.create({
            line_items: [{
                price: settings.priceId,
                quantity: 1,

            }],
            mode: 'payment',
            success_url: `${settings.publicUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${settings.publicUrl}/canceled`,
            metadata: {
                timeslot: forStripe(newBooking.timeslot),
                firstName: forStripe(newBooking.firstName),
                lastName: forStripe(newBooking.lastName),
                email: forStripe(newBooking.email),
                phone: forStripe(newBooking.phone),
                adults: forStripe(newBooking.adults),
                children: forStripe(newBooking.children),
                date: forStripe(newBooking.date),
                accommodation: forStripe(newBooking.accommodation),
                message: forStripe(newBooking.message),
                charter: forStripe(newBooking.charter),
            },
        });

        res.json({ url: session.url });
    } catch (error) {
        // Stripe or the database failed: tell the customer, and keep the server running
        console.error('Error creating checkout session:', error);
        res.status(502).json({ ok: false, data: "We couldn't start the payment. You have not been charged. Please try again, or contact us to book." });
    }
};

const charterConfirmationEmail = (charterData) => ({
                from: 'sarkboattrips@gmail.com',
                to: charterData.email,
                subject: 'PRIVATE CHARTER Confirmation Sark Boat Trips',
                html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbfVS_8hzPlk9unxom9wpjtPJyZ_7XgpjsuA&s"
                                    alt="Sark Boat Trips" width="42" height="42"
                                    style="background-color: white; padding: 0.2rem; border-radius: 50px;">
                                <h3>Dear ${charterData.firstName},</h3>
                                <p>Your <strong style="color: aquamarine;">private charter</strong> on ${showDay(charterData.date)} at
                                    ${charterData.timeslot} has been confirmed and we've received your deposit</p>
                                <p>We love to run unique charters, so if you haven't already, please get in touch so we can plan your trip!</p>
                                <p><a style="color: white; text-decoration: none;" href="mailto:sarkboattrips@gmail.com">&#9993
                                        sarkboattrips@gmail.com</a></p>
                                <p>If your plans change or you need to cancel your charter, please let us know asap</p>
                                <p>We try to be as flexible as we can and just to note that your deposit <strong>is refundable</strong> if we
                                    need to cancel, for example, due
                                    to the weather.</p>
                                <br>
                                <p> Thank you so much for booking with us,</p>
                                <h3>Sark Boat Trips</h3>
                                <hr>
                                <br>
                                <div style="text-align: center;">
                                    <a style="color: white; text-decoration: none; margin: 0; padding: 0;"
                                        href="https://maps.app.goo.gl/E2XLJqrGku7eDePZ8" target='_blank'>&#9875 Creux Harbour, Sark</a>
                                    <br>
                                    <a style="color: white; text-decoration: none;" href="tel:+44-7911-764-246">&#9990 +44 7911 764 246</a>
                                    <br>
                                    <a style="color: white; text-decoration: none;" href="mailto:sarkboattrips@gmail.com">&#9993
                                        sarkboattrips@gmail.com</a>
                                </div>
                            </div>
                        </div>`,
            });

const charterAdminEmail = (charterData) => ({
                from: 'sarkboattrips@gmail.com',
                to: 'sarkboattrips@gmail.com',
                subject: `New CHARTER on : ${showDay(charterData.date)}`,
                html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                            <div
                                style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                                <h3>New PRIVATE CHARTER ${showDay(charterData.date)}</h3>
                                <p>Name: ${charterData.firstName} ${charterData.lastName}</p>
                                <p>Date: ${charterData.timeslot} ${showDay(charterData.date)}.</p>
                                <hr>
                                <p>Message:</p>
                                <p>${charterData.message}</p>
                                <hr>
                                <p>Email : ${charterData.email}</p>
                                <p>Phone : ${charterData.phone}</p>
                                <p>Accommodation : ${charterData.accommodation}</p>
                                <hr>
                                <br>
                                <a style="background-color: rgb(5, 171, 116); color: white; text-decoration: none; padding: 0.5rem;"
                                    href="${settings.dashboardUrl}" target='_blank'>Go to dashboard</a>
                            </div>
                        </div>`,
            });

// Plain text on purpose: this one is for the owner and needs no layout
const charterConflictEmail = (charterData, sessionId) => ({
    from: 'sarkboattrips@gmail.com',
    to: 'sarkboattrips@gmail.com',
    subject: `ACTION NEEDED: paid charter on ${showDay(charterData.date)} clashes with existing bookings`,
    text: `A customer paid for a private charter, but the ${charterData.timeslot} trip on ${showDay(charterData.date)} already had bookings when the payment arrived.

The charter has been saved as a booking and the customer has been sent their confirmation, so you need to either move or cancel the other bookings, or refund this payment in Stripe.

Name: ${charterData.firstName} ${charterData.lastName}
Email: ${charterData.email}
Phone: ${charterData.phone}
Stripe session: ${sessionId}`,
});

// Everything that follows a paid charter checkout. The Stripe webhook, a Stripe retry and the
// customer's /success page can all arrive for the same payment, in any order, so this is safe to
// call repeatedly: the booking is keyed on the Stripe session id, and only the call that
// actually creates it sends the emails.
const fulfillCheckoutSession = async (session) => {
    const charterData = { ...session.metadata };

    const existing = await Bookings.findOne({ stripeSessionId: session.id });
    if (existing) return { booking: existing, created: false };

    // Someone may have booked the slot while this customer was paying
    const conflict = !(await isSlotEmpty(charterData.date, charterData.timeslot));

    let booking;
    try {
        booking = await Bookings.create({ ...charterData, stripeSessionId: session.id });
    } catch (error) {
        if (error.code === 11000) {
            // A parallel call created it between our check and our insert
            return { booking: await Bookings.findOne({ stripeSessionId: session.id }), created: false };
        }
        throw error;
    }
    console.log('Charter booking created for:', charterData);

    // The booking is saved, so a failed email must not undo it: log it and carry on
    const emails = [charterConfirmationEmail(charterData), conflict ? charterConflictEmail(charterData, session.id) : charterAdminEmail(charterData)];
    for (const mail of emails) {
        try {
            await sendEmail(mail);
        } catch (emailError) {
            console.error('Charter email failed:', mail.subject, emailError);
        }
    }

    return { booking, created: true, conflict };
};

// Called by Stripe itself when a payment completes, so the booking exists even if the
// customer never makes it back to the /success page. It is mounted in index.js, before
// express.json(), because verifying the signature needs the raw request body.
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

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object;
        if (session.payment_status === 'paid' && session.metadata?.charter === 'true') {
            // If this throws (e.g. the database is down) Stripe gets a 500 and retries later
            await fulfillCheckoutSession(session);
        }
    }

    res.json({ received: true });
};

// The /success page asks this once the customer comes back from Stripe. It uses the same
// fulfilment as the webhook, so it works whichever of the two gets there first (and when
// no webhook is configured yet, e.g. when testing locally). It always sends exactly one response.
const verifyPayment = async (req, res) => {
    if (settings.stripe.problem) {
        console.error('Payment check refused:', settings.stripe.problem);
        return res.status(503).json({ ok: false, message: paymentsOff.data });
    }

    const { session_id } = req.query;
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
        return res.status(400).json({ ok: false, message: 'Missing or invalid payment session' });
    }

    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (error) {
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(404).json({ ok: false, message: 'Payment not found' });
        }
        throw error;
    }

    const { date, firstName } = session.metadata || {};
    if (session.metadata?.charter !== 'true') {
        return res.status(404).json({ ok: false, message: 'Payment not found' });
    }
    if (session.payment_status !== 'paid') {
        return res.json({ ok: false, message: 'Payment not completed', date, name: firstName });
    }

    await fulfillCheckoutSession(session);
    res.json({ ok: true, message: 'Payment verified and charter booked', date, name: firstName });
};



module.exports = { createCheckOutSession, verifyPayment, webhook }
