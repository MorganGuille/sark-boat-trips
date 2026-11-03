// Every email the site sends, in one place. Each function returns what nodemailer needs (from, to,
// subject, html, text, attachments); the controllers decide when to send it, with trySend or sendEmail
// (utils/mailer.js). The look is in emails/layout.js, the calendar file in emails/calendar.js.
// Dates are written out ('Monday 9 November 2026', 'Mon 9 Nov' in subjects) so they can't be misread.
const { renderEmail, PHONE } = require('./layout');
const { calendarFile } = require('./calendar');
const { settings } = require('../utils/settings');
const { longDay, shortDay } = require('../utils/dates');
const { partyText, seatsFor } = require('../utils/party');
const { cancelRule } = require('../utils/policy');
const { describeTrip } = require('../utils/trips');
const { manageUrl } = require('../utils/manage');
const { coversText, coversShort, validUntil } = require('../utils/vouchers');

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
const isCharter = (booking) => booking.charter === 'true';
// What the booking is: 'private charter', 'boat trip', or an extra trip's own name ('Swim trip')
const what = (booking) => (isCharter(booking) ? 'private charter' : tripOf(booking).extra ? tripOf(booking).name : 'boat trip');
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

// The customer's own "manage my booking" page (utils/manage.js), with a line saying what it is for.
// Nothing if the booking has no link yet (withTrips gives every booking one before emailing).
const manageButton = (booking, line) => (manageUrl(booking) ? [line, { button: { text: 'Manage your booking', link: manageUrl(booking) } }] : []);
const MANAGE_LINE = 'To change the number of people, cancel, or send us a message, use the button below.';

// ---------------------------------------------------------------- customer emails

const tripDetails = (booking, extraRows = []) => ({
    details: [
        ...(tripOf(booking).extra ? [['Trip', tripOf(booking).name]] : []),
        ['Date', longDay(booking.date)],
        ['Time', at(booking)],
        ['Meeting point', { link: harbourOf(booking).map, text: `${harbourOf(booking).name}, Sark` }],
        ['Party', partyText(booking)],
        ...extraRows,
        ...(booking.reference ? [['Booking reference', booking.reference]] : []),
    ],
});

// Where to be. On a day the trip leaves from another harbour, that is said first, in bold. An extra
// trip's own note (e.g. 'Bring swimwear and a towel') follows.
const beThere = (booking) => [
    ...(tripOf(booking).harbourChanged ? [[{ bold: `Please note: this trip leaves from the ${harbourOf(booking).name}, not the Creux Harbour.` }]] : []),
    `Please be at the ${harbourOf(booking).name} shortly before ${at(booking)}. Bring weather appropriate clothing, and any snacks and drinks you'd like.`,
    ...(tripOf(booking).note ? [tripOf(booking).note] : []),
];
const WEATHER = "Sometimes the weather means we have to change the time of a trip. If that happens, we'll contact you.";

// How the booking is paid. A booking with a saved card is charged at the trip time (paymentsspec.md);
// one made on the dashboard is paid on the day. amount: pence, or null if no prices were set.
const paymentRow = (booking, amount) => {
    if (booking.paymentStatus === 'card_saved') {
        return ['Payment', `${amount == null ? 'The trip price' : pounds(amount)}, charged to your saved card at ${at(booking)} on the day`];
    }
    if (['paid', 'paid_in_person'].includes(booking.paymentStatus)) return ['Payment', 'Paid, thank you'];
    if (booking.paymentStatus === 'voucher') return ['Payment', 'Paid with a gift voucher'];
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
            ...manageButton(booking, MANAGE_LINE),
            'If you have any questions, just reply to this email or give us a call.',
        ],
    }, [ics]);
};

// amount: the new price in pence, when the party size changed (the customer's own change)
const updatedEmail = (booking, { amount } = {}) => {
    const ics = calendarFile(booking);
    return customerEmail(booking, `Your booking has changed: ${shortDay(booking.date)} at ${at(booking)}`, {
        heading: 'Your booking has been updated',
        preheader: `Now ${longDay(booking.date)} at ${at(booking)}`,
        blocks: [
            dear(booking),
            "We've updated your booking. Here are the details as they are now:",
            tripDetails(booking, amount === undefined ? [] : [paymentRow(booking, amount)]),
            ...(ics ? ['The calendar file attached to this email has the new details.'] : []),
            ...manageButton(booking, MANAGE_LINE),
            'If anything here looks wrong, please get in touch.',
        ],
    }, [ics]);
};

// What a cancellation email says about money, from how the booking stood when it was cancelled
const cancelPaymentLine = (paymentStatus) => {
    if (paymentStatus === 'card_saved') return "Your card has not been charged, and it won't be charged for this booking.";
    if (['paid', 'paid_in_person', 'charging'].includes(paymentStatus)) return "If you've already paid, please get in touch and we'll sort out a refund.";
    if (paymentStatus === 'voucher') return "Your gift voucher hasn't been used up: please get in touch to book another day.";
    return 'Nothing has been charged.';
};

// apology: set when the owner cancelled the whole trip (cancelTrip)
const cancellationEmail = (booking, apology = '') =>
    customerEmail(booking, `Your ${what(booking)} on ${shortDay(booking.date)} at ${at(booking)} has been cancelled`, {
        heading: 'Your booking has been cancelled',
        preheader: cancelPaymentLine(booking.paymentStatus),
        blocks: [
            dear(booking),
            `Your ${what(booking)} on ${longDay(booking.date)} at ${at(booking)} has been cancelled${booking.reference ? ` (booking reference ${booking.reference})` : ''}.`,
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
            ...manageButton(booking, 'To see your booking or send us a message, use the button below.'),
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
            ...(timeMoved
                ? [manageUrl(booking)
                    ? "If you can't make the new time, you can cancel free of charge with the button below, or just let us know and we'll do it for you."
                    : "If you can't make the new time, let us know and we'll cancel your booking free of charge."]
                : []),
            ...(ics ? ['The calendar file attached to this email has the new details.'] : []),
            ...manageButton(booking, timeMoved ? '' : MANAGE_LINE).filter(Boolean),
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
            ...manageButton(booking, MANAGE_LINE),
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
        ...(tripOf(booking).extra ? [['Trip', tripOf(booking).name]] : []),
        ['When', `${longDay(booking.date)} at ${at(booking)}${tripOf(booking).timeChanged ? ` (moved from ${booking.timeslot})` : ''}`],
        ...(tripOf(booking).harbourChanged ? [['Harbour', harbourOf(booking).name]] : []),
        ['Party', partyText(booking)],
        ...extraRows,
        ['Phone', booking.phone || '(none)'],
        ['Email', booking.email || '(none)'],
        ['Staying at', booking.accommodation || '(not given)'],
        ['Message', booking.message || '(none)'],
        ...(booking.reference ? [['Reference', booking.reference]] : []),
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

// change: set when the customer changed their party size themselves (controllers/manage.js), in words
const updatedOwnerEmail = (booking, { change } = {}) => change
    ? ownerEmail(`Party changed by customer: ${nameOf(booking)}, now ${people(booking)}, ${when(booking)}`, {
        heading: 'The customer changed their booking',
        blocks: [[{ bold: change }], ownerDetails(booking), dashboardButton()],
    })
    : ownerEmail(`Booking changed: ${nameOf(booking)}, now ${when(booking)}`, {
        heading: 'Booking updated',
        blocks: [ownerDetails(booking), dashboardButton()],
    });

const PAYMENT_FOR_OWNER = {
    card_saved: 'card saved, it will not be charged', paid: 'PAID ONLINE: refund it in Stripe if needed',
    paid_in_person: 'PAID IN PERSON: refund it yourself if needed', charging: 'a charge was under way: check Stripe',
    voucher: 'PAID WITH A GIFT VOUCHER: press Undo on the Vouchers tab so it can be used again',
};

// byCustomer: they cancelled it themselves, before the free-cancellation deadline (controllers/manage.js)
const cancelledOwnerEmail = (booking, { byCustomer = false, customerEmailFailed = false } = {}) =>
    ownerEmail(`Cancelled${byCustomer ? ' by customer' : ''}: ${nameOf(booking)}, ${people(booking)}, ${when(booking)}${customerEmailFailed ? CUSTOMER_EMAIL_FAILED : ''}`, {
        heading: byCustomer ? 'The customer cancelled their booking' : 'Booking cancelled',
        blocks: [
            ...(byCustomer ? ['They cancelled it themselves from the link in their email, before the free-cancellation deadline. Their seats are free again.'] : []),
            ...(customerEmailFailed ? ['The cancellation email to the customer could not be sent, so please let them know.'] : []),
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

// The customer sent a message from their manage-my-booking page (e.g. "can we move to the 2pm?").
// Replying to the email answers them directly.
const customerMessageOwnerEmail = (booking, message) => ({
    ...ownerEmail(`Message from ${nameOf(booking)}: ${people(booking)}, ${when(booking)}`, {
        heading: 'A message from a customer',
        blocks: [
            `${nameOf(booking)} sent this from their manage-my-booking page:`,
            ...ownerParagraphs(message).map((paragraph) => [{ bold: paragraph }]),
            booking.email ? 'Reply to this email to answer them.' : 'They have no email address on the booking, so phone them to answer.',
            ownerDetails(booking),
            dashboardButton(),
        ],
    }),
    ...(booking.email && { replyTo: booking.email }),
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
    return ownerEmail(`Trip changed: the ${before.label} on ${shortDay(trip.date)} is now ${now} (${count})`, {
        heading: 'Trip changed',
        blocks: [
            `The ${before.named} on ${longDay(trip.date)} now starts at ${trip.time} and leaves from the ${trip.harbour.name}.`,
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
    return ownerEmail(`Message sent: ${trip.label} ${shortDay(trip.date)}, ${sent} customer${sent === 1 ? '' : 's'}`, {
        heading: 'Message sent',
        blocks: [
            `You sent this message to everyone on the ${trip.named} on ${longDay(trip.date)}:`,
            ...ownerParagraphs(message).map((paragraph) => [{ bold: paragraph }]),
            `Sent to ${sent} of ${bookings.length} booking${bookings.length === 1 ? '' : 's'}:`,
            ...(sent ? [{ list: bookings.filter((b) => !notEmailed.includes(b)).map(line) }] : []),
            ...(notEmailed.length ? [[{ bold: 'NOT EMAILED (no address, or the email failed), please contact them:' }], { list: notEmailed.map(line) }] : []),
            dashboardButton(),
        ],
    });
};

// The owner cancelled a whole trip (controllers/bookings.js cancelTrip)
const tripCancelledOwnerEmail = ({ date, time, named = `${time} trip`, reasonText, cancelled, notEmailed, toRefund }) => {
    const count = `${cancelled.length} booking${cancelled.length === 1 ? '' : 's'}`;
    const line = (b) => `${nameOf(b)}, ${partyText(b)}${b.phone ? `, phone ${b.phone}` : ''}`;
    return ownerEmail(`Trip cancelled: ${time} ${shortDay(date)}, ${count}`, {
        heading: 'Trip cancelled',
        blocks: [
            `You cancelled the ${named} on ${longDay(date)}${reasonText}. It is closed to new bookings (reopen it from the Availability tab).`,
            `${count} cancelled. Nobody's saved card will be charged.`,
            ...(cancelled.length ? [{ list: cancelled.map(line) }] : []),
            ...(notEmailed.length ? [[{ bold: 'NOT EMAILED (no address, or the email failed), please contact them:' }], { list: notEmailed.map(line) }] : []),
            ...(toRefund.length ? [[{ bold: 'ALREADY PAID, refund them (online payments in Stripe):' }], { list: toRefund.map(line) }] : []),
            dashboardButton(),
        ],
    });
};

// ---------------------------------------------------------------- gift vouchers (utils/vouchers.js)

const VOUCHER_RULE = 'The voucher can be passed on to someone else, but it cannot be exchanged for money or refunded.';
const howToBook = () => `To book, call or WhatsApp ${PHONE} or email ${settings.mail.from} with the voucher code, and we'll find you a day.`;
const voucherDetails = (voucher, extraRows = []) => ({
    details: [
        ...(voucher.recipientName ? [['For', voucher.recipientName]] : []),
        ...(voucher.buyerName ? [['From', voucher.buyerName]] : []),
        ['Covers', coversText(voucher)],
        ['Valid until', validUntil(voucher)],
        ['Code', voucher.code],
        ...extraRows,
    ],
});
const voucherPdfFile = (voucher, pdf) => ({ filename: `sark-boat-trips-gift-voucher-${voucher.code}.pdf`, content: pdf, contentType: 'application/pdf' });
const toSomeoneElse = (voucher) => Boolean(voucher.recipientEmail) && voucher.deliverTo === voucher.recipientEmail && voucher.recipientEmail !== voucher.buyerEmail;
const giftWhat = (voucher) => (voucher.kind === 'charter' ? 'a private charter' : 'a boat trip');

// The voucher itself, to whoever it is sent to (the buyer, or the person it's for), with the PDF
const voucherEmail = (voucher, pdf) => {
    const forThem = toSomeoneElse(voucher);
    const { html, text, attachments } = renderEmail({
        heading: forThem ? `${voucher.recipientName || 'Hello'}, you've been given ${giftWhat(voucher)} around Sark!` : 'Your gift voucher',
        preheader: `${coversText(voucher)}, valid until ${validUntil(voucher)}`,
        signoff: 'See you on the water,',
        blocks: [
            forThem
                ? `${voucher.buyerName || 'Someone'} has given you ${giftWhat(voucher)} with Sark Boat Trips.`
                : `Thank you for buying a Sark Boat Trips gift voucher. It's attached as a PDF, ready to print or forward${voucher.recipientName ? ` to ${voucher.recipientName}` : ''}.`,
            ...(voucher.message ? [[{ bold: `"${voucher.message}"` }]] : []),
            voucherDetails(voucher),
            howToBook(),
            ...(forThem ? ['The voucher is attached as a PDF, if you would like to print it.'] : []),
            VOUCHER_RULE,
        ],
    });
    return { from: settings.mail.sender, to: voucher.deliverTo, subject: forThem ? `A gift for you: ${giftWhat(voucher)} around Sark` : 'Your Sark Boat Trips gift voucher', html, text, attachments: [...attachments, voucherPdfFile(voucher, pdf)] };
};

// The buyer's receipt, when the voucher goes to someone else (now or on a later day), with the PDF too
const voucherBoughtEmail = (voucher, pdf) => {
    const later = Boolean(voucher.sendOn) && !voucher.sentAt;
    const { html, text, attachments } = renderEmail({
        heading: 'Thank you for your gift voucher',
        preheader: later ? `We'll email it to ${voucher.recipientName || voucher.recipientEmail} on ${longDay(voucher.sendOn)}` : `We've emailed it to ${voucher.recipientName || voucher.recipientEmail}`,
        signoff: 'Thank you so much,',
        blocks: [
            `Dear ${voucher.buyerName || 'customer'},`,
            later
                ? `Thank you for buying a gift voucher. We'll email it to ${voucher.recipientEmail} on ${longDay(voucher.sendOn)}, in the morning.`
                : `Thank you for buying a gift voucher. We've emailed it to ${voucher.recipientEmail}.`,
            voucherDetails(voucher, [['Paid', pounds(voucher.amountPaid || 0)]]),
            'A copy is attached as a PDF, in case you would like to print it.',
            VOUCHER_RULE,
        ],
    });
    return { from: settings.mail.sender, to: voucher.buyerEmail, subject: 'Your gift voucher receipt', html, text, attachments: [...attachments, voucherPdfFile(voucher, pdf)] };
};

const voucherLine = (voucher) => `${coversShort(voucher)}${voucher.recipientName ? ` for ${voucher.recipientName}` : ''}`;

// A voucher was bought online. emailFailed: the voucher (or receipt) could not be sent.
const voucherSoldOwnerEmail = (voucher, { emailFailed = false } = {}) =>
    ownerEmail(`Gift voucher sold: ${voucherLine(voucher)}, ${pounds(voucher.amountPaid || 0)}${emailFailed ? ' (EMAIL FAILED)' : ''}`, {
        heading: 'Gift voucher sold',
        blocks: [
            ...(emailFailed ? [[{ bold: 'The voucher email could not be sent. Use Resend on the Vouchers tab, or contact them.' }]] : []),
            voucherDetails(voucher, [
                ['Paid', `${pounds(voucher.amountPaid || 0)} by card`],
                ['Bought by', [voucher.buyerName, voucher.buyerEmail].filter(Boolean).join(', ') || '(not given)'],
                ['Sent to', voucher.sendOn && !voucher.sentAt ? `${voucher.deliverTo} on ${longDay(voucher.sendOn)}` : voucher.deliverTo || '(nobody)'],
            ]),
            dashboardButton(),
        ],
    });

// A voucher email set for a later day failed every time
const voucherNotSentOwnerEmail = (voucher) =>
    ownerEmail(`Gift voucher NOT emailed: ${voucherLine(voucher)} to ${voucher.deliverTo}`, {
        heading: 'A gift voucher could not be emailed',
        blocks: [
            `The voucher could not be emailed to ${voucher.deliverTo}. Check the address, then use Resend on the Vouchers tab, or contact them.`,
            voucherDetails(voucher),
            dashboardButton(),
        ],
    });

module.exports = {
    confirmationEmail, updatedEmail, cancellationEmail, reminderEmail, tripChangedEmail, tripMessageEmail, tripFullEmail,
    newBookingOwnerEmail, updatedOwnerEmail, cancelledOwnerEmail, customerMessageOwnerEmail, tripFullOwnerEmail, failedChargesEmail, tripCancelledOwnerEmail, tripChangedOwnerEmail, tripMessageOwnerEmail,
    voucherEmail, voucherBoughtEmail, voucherSoldOwnerEmail, voucherNotSentOwnerEmail,
};
