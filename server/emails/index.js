// Every email the site sends, in one place. Each function returns what nodemailer needs (from, to,
// subject, html, text, attachments); the controllers decide when to send it, with trySend or sendEmail
// (utils/mailer.js). The look is in emails/layout.js, the calendar file in emails/calendar.js.
// Dates are written out ('Monday 9 November 2026', 'Mon 9 Nov' in subjects) so they can't be misread.
const { renderEmail } = require('./layout');
const { calendarFile } = require('./calendar');
const { settings } = require('../utils/settings');
const { longDay, shortDay } = require('../utils/dates');
const { partyText, seatsFor } = require('../utils/party');
const { cancelRule } = require('../utils/policy');
const { describeTrip } = require('../utils/trips');

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
const isCharter = (booking) => booking.charter === 'true';
const what = (booking) => (isCharter(booking) ? 'private charter' : 'boat trip');
const nameOf = (booking) => [booking.firstName, booking.lastName].filter(Boolean).join(' ') || '(no name)';
const people = (booking) => `${seatsFor(booking)} ${seatsFor(booking) === 1 ? 'person' : 'people'}`;
const dear = (booking) => `Dear ${booking.firstName || 'guest'},`;
// When and where the booking's trip leaves that day: the owner may have moved it (utils/trips.js;
// withTrips adds booking.trip before sending). Without it, the usual time and harbour.
const tripOf = (booking) => booking.trip || describeTrip(booking.date, booking.timeslot);
const at = (booking) => tripOf(booking).time;
const harbourOf = (booking) => tripOf(booking).harbour;

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
        ['Time', at(booking)],
        ['Meeting point', { link: harbourOf(booking).map, text: `${harbourOf(booking).name}, Sark` }],
        ['Party', partyText(booking)],
        ...extraRows,
    ],
});

// Where to be. On a day the trip leaves from another harbour, that is said first, in bold.
const beThere = (booking) => [
    ...(tripOf(booking).harbourChanged ? [[{ bold: `Please note: this trip leaves from the ${harbourOf(booking).name}, not the Creux Harbour.` }]] : []),
    `Please be at the ${harbourOf(booking).name} shortly before ${at(booking)}. Bring weather appropriate clothing, and any snacks and drinks you'd like.`,
];
const WEATHER = "Sometimes the weather means we have to change the time of a trip. If that happens, we'll contact you.";

// How the booking is paid. A booking with a saved card is charged at the trip time (paymentsspec.md);
// one made on the dashboard is paid on the day. amount: pence, or null if no prices were set.
const paymentRow = (booking, amount) => {
    if (booking.paymentStatus === 'card_saved') {
        return ['Payment', `${amount == null ? 'The trip price' : pounds(amount)}, charged to your saved card at ${at(booking)} on the day`];
    }
    if (['paid', 'paid_in_person'].includes(booking.paymentStatus)) return ['Payment', 'Paid, thank you'];
    return ['Payment', 'At the end of the trip, by cash or card'];
};

// Sent when a booking is made (online or on the dashboard) and when a cancelled one is restored
const confirmationEmail = (booking, amount = null) => {
    const ics = calendarFile(booking);
    const card = booking.paymentStatus === 'card_saved';
    return customerEmail(booking, `Your ${what(booking)} on ${shortDay(booking.date)} at ${at(booking)} is confirmed`, {
        heading: isCharter(booking) ? 'Your private charter is confirmed' : 'Your booking is confirmed',
        preheader: `${longDay(booking.date)} at ${at(booking)}, ${harbourOf(booking).name}, Sark`,
        blocks: [
            dear(booking),
            `Thank you for booking ${isCharter(booking) ? 'a private charter ' : ''}with us. Here are your details:`,
            tripDetails(booking, [paymentRow(booking, amount)]),
            ...beThere(booking),
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
    return customerEmail(booking, `Your booking has changed: ${shortDay(booking.date)} at ${at(booking)}`, {
        heading: 'Your booking has been updated',
        preheader: `Now ${longDay(booking.date)} at ${at(booking)}`,
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
    customerEmail(booking, `Your ${what(booking)} on ${shortDay(booking.date)} at ${at(booking)} has been cancelled`, {
        heading: 'Your booking has been cancelled',
        preheader: cancelPaymentLine(booking.paymentStatus),
        blocks: [
            dear(booking),
            `Your ${what(booking)} on ${longDay(booking.date)} at ${at(booking)} has been cancelled.`,
            ...(apology ? [apology] : []),
            cancelPaymentLine(booking.paymentStatus),
            ...(apology ? [] : ['If this is a mistake, please get in touch.']),
        ],
    });

// The evening before (utils/reminders.js). No payment line: the owner's choice.
const reminderEmail = (booking) =>
    customerEmail(booking, `See you tomorrow at ${at(booking)}`, {
        heading: `See you tomorrow at ${at(booking)}`,
        preheader: `Your ${what(booking)} is tomorrow at ${at(booking)}, ${harbourOf(booking).name}`,
        signoff: 'See you tomorrow!',
        blocks: [
            dear(booking),
            `Just a reminder that your ${what(booking)} is tomorrow. Here are the details:`,
            tripDetails(booking),
            ...beThere(booking),
            WEATHER,
            'If you can no longer come, please let us know as soon as possible.',
        ],
    });

// The owner moved a trip to another time and/or harbour for the day (controllers/trips.js).
// before: the trip as it was; booking.trip: as it is now. note: the owner's own words, if any.
const tripChangedEmail = (booking, { before, note = '' }) => {
    const trip = tripOf(booking);
    const timeMoved = trip.startTime !== before.startTime;
    const harbourMoved = trip.harbour.key !== before.harbour.key;
    const ics = calendarFile(booking);
    const subject = timeMoved && harbourMoved
        ? `Your ${what(booking)} on ${shortDay(booking.date)} has moved to ${trip.time}, from the ${trip.harbour.name}`
        : timeMoved
            ? `Your ${what(booking)} on ${shortDay(booking.date)} has moved to ${trip.time}`
            : `Your ${what(booking)} on ${shortDay(booking.date)} at ${trip.time} now leaves from the ${trip.harbour.name}`;
    const changes = [
        ...(timeMoved ? [`now starts at ${trip.time} (instead of ${before.time})`] : []),
        ...(harbourMoved ? [`leaves from the ${trip.harbour.name} (instead of the ${before.harbour.name})`] : []),
    ];
    return customerEmail(booking, subject, {
        heading: timeMoved && harbourMoved ? 'Your trip time and harbour have changed' : timeMoved ? 'Your trip time has changed' : 'Your trip leaves from a different harbour',
        preheader: `${longDay(booking.date)}: ${changes.join(' and ')}`,
        blocks: [
            dear(booking),
            `Your ${what(booking)} on ${longDay(booking.date)} ${changes.join(' and ')}.`,
            ...(note.trim() ? [note.trim()] : []),
            tripDetails(booking),
            `Please be at the ${trip.harbour.name} shortly before ${trip.time}.`,
            ...(timeMoved ? ["If you can't make the new time, let us know and we'll cancel your booking free of charge."] : []),
            ...(ics ? ['The calendar file attached to this email has the new details.'] : []),
            'If you have any questions, just reply to this email or give us a call.',
        ],
    }, [ics]);
};

// The owner's own message to everyone on a trip (controllers/trips.js), e.g. "bring a jacket, it's
// choppy". Each line the owner typed becomes its own paragraph.
const ownerParagraphs = (message) => message.split(/\n+/).map((line) => line.trim()).filter(Boolean);

const tripMessageEmail = (booking, message) =>
    customerEmail(booking, `A message about your ${what(booking)} on ${shortDay(booking.date)} at ${at(booking)}`, {
        heading: 'A message about your trip',
        preheader: ownerParagraphs(message)[0],
        blocks: [
            dear(booking),
            ...ownerParagraphs(message),
            `Your booking:`,
            tripDetails(booking),
            'If you have any questions, just reply to this email or give us a call.',
        ],
    });

// The trip filled up while the customer was on Stripe's page (controllers/checkout.js)
const tripFullEmail = (booking) =>
    customerEmail(booking, `Sorry, the ${what(booking)} on ${shortDay(booking.date)} at ${at(booking)} is full`, {
        heading: 'Sorry, that trip filled up',
        preheader: 'Nothing has been charged.',
        blocks: [
            dear(booking),
            `While you were entering your card, the last places on the ${at(booking)} ${what(booking)} on ${longDay(booking.date)} were taken, so we couldn't book you.`,
            [{ bold: 'Nothing has been charged.' }],
            ['Please choose another trip on ', settings.publicUrl ? { link: settings.publicUrl, text: 'our website' } : 'our website', ", or get in touch and we'll do our best to fit you in."],
        ],
    });

// ---------------------------------------------------------------- the owner's emails
// Subjects carry the essentials (who, how many, when), so a phone notification is enough.

const when = (booking) => `${at(booking)} ${shortDay(booking.date)}`;

const ownerDetails = (booking, extraRows = []) => ({
    details: [
        ['Name', nameOf(booking)],
        ['When', `${longDay(booking.date)} at ${at(booking)}${tripOf(booking).timeChanged ? ` (moved from ${booking.timeslot})` : ''}`],
        ...(tripOf(booking).harbourChanged ? [['Harbour', harbourOf(booking).name]] : []),
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
            ownerDetails(booking, [['Payment', `Card saved: ${amount == null ? 'amount unknown (no prices set)' : pounds(amount)}, charged at ${at(booking)} on the day`]]),
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
            `A customer saved their card, but by then the ${at(booking)} ${what(booking)} on ${longDay(booking.date)} had no room left, so the booking was not made and nothing was charged.${customerEmailFailed ? '' : ' They have been emailed.'}`,
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
                    `${nameOf(booking)}, ${at(booking)} on ${longDay(booking.date)}, ${partyText(booking)}${amount ? `, ${pounds(amount)}` : ''}. ${reason}${booking.phone ? ` Phone: ${booking.phone}` : ''}`),
            },
            dashboardButton(),
        ],
    });
};

// The owner moved a trip (controllers/trips.js): one summary instead of one email per booking.
// trip / before: the trip now and as it was; bookings: those on it; notEmailed: no address or the
// email failed; notified: false when the owner chose not to email customers.
const tripChangedOwnerEmail = ({ trip, before, note, bookings, notEmailed, notified, warning }) => {
    const line = (b) => `${nameOf(b)}, ${partyText(b)}${b.phone ? `, phone ${b.phone}` : ''}`;
    const now = [trip.time, ...(trip.harbour.key !== before.harbour.key ? [`from the ${trip.harbour.name}`] : [])].join(', ');
    const count = `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`;
    return ownerEmail(`Trip changed: the ${before.time} on ${shortDay(trip.date)} is now ${now} (${count})`, {
        heading: 'Trip changed',
        blocks: [
            `The ${before.time} trip on ${longDay(trip.date)} now starts at ${trip.time} and leaves from the ${trip.harbour.name}.`,
            ...(warning ? [[{ bold: warning }]] : []),
            ...(note ? [`Your note to customers: "${note}"`] : []),
            notified
                ? `${count} on it${bookings.length ? ', emailed with the new details and a calendar file' : ''}.`
                : `${count} on it. You chose not to email them.`,
            ...(bookings.length ? [{ list: bookings.map(line) }] : []),
            ...(notified && notEmailed.length ? [[{ bold: 'NOT EMAILED (no address, or the email failed), please contact them:' }], { list: notEmailed.map(line) }] : []),
            dashboardButton(),
        ],
    });
};

// The owner messaged everyone on a trip: one summary of what was sent and to whom
const tripMessageOwnerEmail = ({ trip, message, bookings, notEmailed }) => {
    const line = (b) => `${nameOf(b)}, ${partyText(b)}${b.phone ? `, phone ${b.phone}` : ''}`;
    const sent = bookings.length - notEmailed.length;
    return ownerEmail(`Message sent: ${trip.time} ${shortDay(trip.date)}, ${sent} customer${sent === 1 ? '' : 's'}`, {
        heading: 'Message sent',
        blocks: [
            `You sent this message to everyone on the ${trip.time} trip on ${longDay(trip.date)}:`,
            ...ownerParagraphs(message).map((paragraph) => [{ bold: paragraph }]),
            `Sent to ${sent} of ${bookings.length} booking${bookings.length === 1 ? '' : 's'}:`,
            ...(sent ? [{ list: bookings.filter((b) => !notEmailed.includes(b)).map(line) }] : []),
            ...(notEmailed.length ? [[{ bold: 'NOT EMAILED (no address, or the email failed), please contact them:' }], { list: notEmailed.map(line) }] : []),
            dashboardButton(),
        ],
    });
};

// The owner cancelled a whole trip (controllers/bookings.js cancelTrip)
const tripCancelledOwnerEmail = ({ date, time, reasonText, cancelled, notEmailed, toRefund }) => {
    const count = `${cancelled.length} booking${cancelled.length === 1 ? '' : 's'}`;
    const line = (b) => `${nameOf(b)}, ${partyText(b)}${b.phone ? `, phone ${b.phone}` : ''}`;
    return ownerEmail(`Trip cancelled: ${time} ${shortDay(date)}, ${count}`, {
        heading: 'Trip cancelled',
        blocks: [
            `You cancelled the ${time} trip on ${longDay(date)}${reasonText}. It is closed to new bookings (reopen it from the Availability tab).`,
            `${count} cancelled. Nobody's saved card will be charged.`,
            ...(cancelled.length ? [{ list: cancelled.map(line) }] : []),
            ...(notEmailed.length ? [[{ bold: 'NOT EMAILED (no address, or the email failed), please contact them:' }], { list: notEmailed.map(line) }] : []),
            ...(toRefund.length ? [[{ bold: 'ALREADY PAID, refund them (online payments in Stripe):' }], { list: toRefund.map(line) }] : []),
            dashboardButton(),
        ],
    });
};

module.exports = {
    confirmationEmail, updatedEmail, cancellationEmail, reminderEmail, tripChangedEmail, tripMessageEmail, tripFullEmail,
    newBookingOwnerEmail, updatedOwnerEmail, cancelledOwnerEmail, tripFullOwnerEmail, failedChargesEmail, tripCancelledOwnerEmail, tripChangedOwnerEmail, tripMessageOwnerEmail,
};
