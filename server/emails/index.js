// Every email the site sends, in one place. Each function returns what nodemailer needs (from, to,
// subject, html, text, attachments); the controllers decide when to send it, with trySend or sendEmail
// (utils/mailer.js). The look is in emails/layout.js, the calendar file in emails/calendar.js.
// Dates are written out ('Monday 9 November 2026', 'Mon 9 Nov' in subjects) so they can't be misread.
const { renderEmail, MAP_LINK, HARBOUR } = require('./layout');
const { calendarFile } = require('./calendar');
const { settings } = require('../utils/settings');
const { longDay, shortDay } = require('../utils/dates');
const { partyText, seatsFor } = require('../utils/party');
const { cancelRule } = require('../utils/policy');

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
const isCharter = (booking) => booking.charter === 'true';
const what = (booking) => (isCharter(booking) ? 'private charter' : 'boat trip');
const nameOf = (booking) => [booking.firstName, booking.lastName].filter(Boolean).join(' ') || '(no name)';
const people = (booking) => `${seatsFor(booking)} ${seatsFor(booking) === 1 ? 'person' : 'people'}`;
const dear = (booking) => `Dear ${booking.firstName || 'guest'},`;

const customerEmail = (booking, subject, content, extraAttachments = []) => {
    const { html, text, attachments } = renderEmail({ signoff: 'Thank you so much,', ...content });
    return { from: settings.mail.sender, to: booking.email, subject, html, text, attachments: [...attachments, ...extraAttachments.filter(Boolean)] };
};

const ownerEmail = (subject, content) => {
    const { html, text, attachments } = renderEmail({ ...content, forOwner: true });
    return { from: settings.mail.sender, to: settings.mail.owner, subject, html, text, attachments };
};

const dashboardButton = () => ({ button: { text: 'Open the dashboard', link: settings.dashboardUrl } });

// ---------------------------------------------------------------- customer emails

const tripDetails = (booking, extraRows = []) => ({
    details: [
        ['Date', longDay(booking.date)],
        ['Time', booking.timeslot],
        ['Meeting point', { link: MAP_LINK, text: HARBOUR }],
        ['Party', partyText(booking)],
        ...extraRows,
    ],
});

const BE_THERE = (booking) => `Please be at the Creux Harbour shortly before ${booking.timeslot}. Bring weather appropriate clothing, and any snacks and drinks you'd like.`;
const WEATHER = "Sometimes the weather means we have to change the time of a trip. If that happens, we'll contact you.";

// How the booking is paid. A booking with a saved card is charged at the trip time (paymentsspec.md);
// one made on the dashboard is paid on the day. amount: pence, or null if no prices were set.
const paymentRow = (booking, amount) => {
    if (booking.paymentStatus === 'card_saved') {
        return ['Payment', `${amount == null ? 'The trip price' : pounds(amount)}, charged to your saved card at ${booking.timeslot} on the day`];
    }
    if (['paid', 'paid_in_person'].includes(booking.paymentStatus)) return ['Payment', 'Paid, thank you'];
    return ['Payment', 'At the end of the trip, by cash or card'];
};

// Sent when a booking is made (online or on the dashboard) and when a cancelled one is restored
const confirmationEmail = (booking, amount = null) => {
    const ics = calendarFile(booking);
    const card = booking.paymentStatus === 'card_saved';
    return customerEmail(booking, `Your ${what(booking)} on ${shortDay(booking.date)} at ${booking.timeslot} is confirmed`, {
        heading: isCharter(booking) ? 'Your private charter is confirmed' : 'Your booking is confirmed',
        preheader: `${longDay(booking.date)} at ${booking.timeslot}, ${HARBOUR}`,
        blocks: [
            dear(booking),
            `Thank you for booking ${isCharter(booking) ? 'a private charter ' : ''}with us. Here are your details:`,
            tripDetails(booking, [paymentRow(booking, amount)]),
            BE_THERE(booking),
            ...(isCharter(booking) ? ["We love to run unique charters, so if you haven't already, please get in touch so we can plan your trip!"] : []),
            card
                ? `Nothing has been taken from your card yet. ${cancelRule(isCharter(booking))} If we have to cancel because of the weather, you won't be charged.`
                : 'If you need to cancel, please let us know as soon as possible.',
            WEATHER,
            ...(ics ? ['To add the trip to your calendar, open the calendar file attached to this email.'] : []),
            'If you have any questions, just reply to this email or give us a call.',
        ],
    }, [ics]);
};

const updatedEmail = (booking) => {
    const ics = calendarFile(booking);
    return customerEmail(booking, `Your booking has changed: ${shortDay(booking.date)} at ${booking.timeslot}`, {
        heading: 'Your booking has been updated',
        preheader: `Now ${longDay(booking.date)} at ${booking.timeslot}`,
        blocks: [
            dear(booking),
            "We've updated your booking. Here are the details as they are now:",
            tripDetails(booking),
            ...(ics ? ['The calendar file attached to this email has the new details.'] : []),
            'If anything here looks wrong, please get in touch.',
        ],
    }, [ics]);
};

// What a cancellation email says about money, from how the booking stood when it was cancelled
const cancelPaymentLine = (paymentStatus) => {
    if (paymentStatus === 'card_saved') return "Your card has not been charged, and it won't be charged for this booking.";
    if (['paid', 'paid_in_person', 'charging'].includes(paymentStatus)) return "If you've already paid, please get in touch and we'll sort out a refund.";
    return 'Nothing has been charged.';
};

// apology: set when the owner cancelled the whole trip (cancelTrip)
const cancellationEmail = (booking, apology = '') =>
    customerEmail(booking, `Your ${what(booking)} on ${shortDay(booking.date)} at ${booking.timeslot} has been cancelled`, {
        heading: 'Your booking has been cancelled',
        preheader: cancelPaymentLine(booking.paymentStatus),
        blocks: [
            dear(booking),
            `Your ${what(booking)} on ${longDay(booking.date)} at ${booking.timeslot} has been cancelled.`,
            ...(apology ? [apology] : []),
            cancelPaymentLine(booking.paymentStatus),
            ...(apology ? [] : ['If this is a mistake, please get in touch.']),
        ],
    });

// The evening before (utils/reminders.js). No payment line: the owner's choice.
const reminderEmail = (booking) =>
    customerEmail(booking, `See you tomorrow at ${booking.timeslot}`, {
        heading: `See you tomorrow at ${booking.timeslot}`,
        preheader: `Your ${what(booking)} is tomorrow at ${booking.timeslot}, ${HARBOUR}`,
        signoff: 'See you tomorrow!',
        blocks: [
            dear(booking),
            `Just a reminder that your ${what(booking)} is tomorrow. Here are the details:`,
            tripDetails(booking),
            BE_THERE(booking),
            WEATHER,
            'If you can no longer come, please let us know as soon as possible.',
        ],
    });

// The trip filled up while the customer was on Stripe's page (controllers/checkout.js)
const tripFullEmail = (booking) =>
    customerEmail(booking, `Sorry, the ${what(booking)} on ${shortDay(booking.date)} at ${booking.timeslot} is full`, {
        heading: 'Sorry, that trip filled up',
        preheader: 'Nothing has been charged.',
        blocks: [
            dear(booking),
            `While you were entering your card, the last places on the ${booking.timeslot} ${what(booking)} on ${longDay(booking.date)} were taken, so we couldn't book you.`,
            [{ bold: 'Nothing has been charged.' }],
            ['Please choose another trip on ', settings.publicUrl ? { link: settings.publicUrl, text: 'our website' } : 'our website', ", or get in touch and we'll do our best to fit you in."],
        ],
    });

// ---------------------------------------------------------------- the owner's emails
// Subjects carry the essentials (who, how many, when), so a phone notification is enough.

const when = (booking) => `${booking.timeslot} ${shortDay(booking.date)}`;

const ownerDetails = (booking, extraRows = []) => ({
    details: [
        ['Name', nameOf(booking)],
        ['When', `${longDay(booking.date)} at ${booking.timeslot}`],
        ['Party', partyText(booking)],
        ...extraRows,
        ['Phone', booking.phone || '(none)'],
        ['Email', booking.email || '(none)'],
        ['Staying at', booking.accommodation || '(not given)'],
        ['Message', booking.message || '(none)'],
    ],
});

const CUSTOMER_EMAIL_FAILED = ' (CUSTOMER EMAIL FAILED, please contact them)';

// A customer booked online. amount: what the card will be charged, in pence (null if unknown).
const newBookingOwnerEmail = (booking, { amount = null, customerEmailFailed = false } = {}) =>
    ownerEmail(`New ${isCharter(booking) ? 'charter' : 'booking'}: ${nameOf(booking)}, ${people(booking)}, ${when(booking)}${customerEmailFailed ? CUSTOMER_EMAIL_FAILED : ''}`, {
        heading: isCharter(booking) ? 'New private charter' : 'New booking',
        blocks: [
            ...(customerEmailFailed ? [[{ bold: "The customer's confirmation email could not be sent. Please contact them." }]] : []),
            ownerDetails(booking, [['Payment', `Card saved: ${amount == null ? 'amount unknown (no prices set)' : pounds(amount)}, charged at ${booking.timeslot} on the day`]]),
            dashboardButton(),
        ],
    });

const updatedOwnerEmail = (booking) =>
    ownerEmail(`Booking changed: ${nameOf(booking)}, now ${when(booking)}`, {
        heading: 'Booking updated',
        blocks: [ownerDetails(booking), dashboardButton()],
    });

const PAYMENT_FOR_OWNER = {
    card_saved: 'card saved, it will not be charged', paid: 'PAID ONLINE: refund it in Stripe if needed',
    paid_in_person: 'PAID IN PERSON: refund it yourself if needed', charging: 'a charge was under way: check Stripe',
};

const cancelledOwnerEmail = (booking) =>
    ownerEmail(`Cancelled: ${nameOf(booking)}, ${people(booking)}, ${when(booking)}`, {
        heading: 'Booking cancelled',
        blocks: [
            ownerDetails(booking, [['Payment', PAYMENT_FOR_OWNER[booking.paymentStatus] || 'unpaid, nothing to refund']]),
            dashboardButton(),
        ],
    });

const tripFullOwnerEmail = (booking, { customerEmailFailed = false } = {}) =>
    ownerEmail(`Booking NOT made (trip full): ${nameOf(booking)}, ${people(booking)}, ${when(booking)}${customerEmailFailed ? CUSTOMER_EMAIL_FAILED : ''}`, {
        heading: 'Booking not made: the trip filled up',
        blocks: [
            `A customer saved their card, but by then the ${booking.timeslot} ${what(booking)} on ${longDay(booking.date)} had no room left, so the booking was not made and nothing was charged.${customerEmailFailed ? '' : ' They have been emailed.'}`,
            'It is on the dashboard as a cancelled booking (Show cancelled). If room frees up you can restore it, and their card will then be charged at the trip time.',
            ownerDetails(booking),
            dashboardButton(),
        ],
    });

// failures: [{ booking, amount, reason }] from utils/charges.js
const failedChargesEmail = (failures) => {
    const subject = failures.length === 1
        ? `Card payment failed: ${nameOf(failures[0].booking)}, ${when(failures[0].booking)}: collect on the day`
        : `Card payment failed for ${failures.length} bookings: collect on the day`;
    return ownerEmail(subject, {
        heading: failures.length === 1 ? 'A card payment failed' : `${failures.length} card payments failed`,
        blocks: [
            failures.length === 1
                ? "This booking could not be charged to the customer's saved card. It is marked Unpaid on the dashboard. Please take the payment on the day (cash or card reader) and press Mark paid."
                : "These bookings could not be charged to the customers' saved cards. They are marked Unpaid on the dashboard. Please take the payment on the day (cash or card reader) and press Mark paid.",
            {
                list: failures.map(({ booking, amount, reason }) =>
                    `${nameOf(booking)}, ${booking.timeslot} on ${longDay(booking.date)}, ${partyText(booking)}${amount ? `, ${pounds(amount)}` : ''}. ${reason}${booking.phone ? ` Phone: ${booking.phone}` : ''}`),
            },
            dashboardButton(),
        ],
    });
};

// The owner cancelled a whole trip (controllers/bookings.js cancelTrip)
const tripCancelledOwnerEmail = ({ date, timeslot, reasonText, cancelled, notEmailed, toRefund }) => {
    const count = `${cancelled.length} booking${cancelled.length === 1 ? '' : 's'}`;
    const line = (b) => `${nameOf(b)}, ${partyText(b)}${b.phone ? `, phone ${b.phone}` : ''}`;
    return ownerEmail(`Trip cancelled: ${timeslot} ${shortDay(date)}, ${count}`, {
        heading: 'Trip cancelled',
        blocks: [
            `You cancelled the ${timeslot} trip on ${longDay(date)}${reasonText}. It is closed to new bookings (reopen it from the Availability tab).`,
            `${count} cancelled. Nobody's saved card will be charged.`,
            ...(cancelled.length ? [{ list: cancelled.map(line) }] : []),
            ...(notEmailed.length ? [[{ bold: 'NOT EMAILED (no address, or the email failed), please contact them:' }], { list: notEmailed.map(line) }] : []),
            ...(toRefund.length ? [[{ bold: 'ALREADY PAID, refund them (online payments in Stripe):' }], { list: toRefund.map(line) }] : []),
            dashboardButton(),
        ],
    });
};

module.exports = {
    confirmationEmail, updatedEmail, cancellationEmail, reminderEmail, tripFullEmail,
    newBookingOwnerEmail, updatedOwnerEmail, cancelledOwnerEmail, tripFullOwnerEmail, failedChargesEmail, tripCancelledOwnerEmail,
};
