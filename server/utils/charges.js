// Charges saved cards at the trip time (paymentsspec.md, step 3). index.js runs this every minute;
// the tests call runDueCharges with a fixed clock. Everything here is safe to run twice at once:
// a booking is claimed before Stripe is called, and Stripe's idempotency key stops a second charge.
const Bookings = require('../models/bookings');
const stripe = require('./stripe');
const { tripStartsAt, guernseyToday } = require('./validateBooking');
const { readPrices, bookingValue } = require('./prices');
const { showDay } = require('./dates');
const { partyText } = require('./party');
const { trySend } = require('./mailer');
const { settings } = require('./settings');

const RETRY_AFTER_MINUTES = 10; // a charge stuck in "charging" (a crash, or Stripe unreachable) is retried after this
const MAX_ATTEMPTS = 5; // then it is given up and marked unpaid for the owner to collect

const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;

// Stripe's reasons, in words the owner can act on
const reasonFor = (error) => {
    const code = error?.decline_code || error?.code;
    if (code === 'authentication_required') return 'The bank wanted the customer to confirm the payment, so it could not be taken automatically.';
    if (code === 'insufficient_funds') return 'The card was declined: not enough money in the account.';
    if (code === 'expired_card') return 'The card has expired.';
    if (code === 'lost_card' || code === 'stolen_card') return 'The card was declined (reported lost or stolen).';
    if (code === 'incorrect_number' || code === 'invalid_account') return 'The card details are no longer valid.';
    return 'The card was declined.';
};

const markUnpaid = (booking, note) => Bookings.updateOne(
    { _id: booking._id, paymentStatus: 'charging' },
    { $set: { paymentStatus: 'unpaid', paymentNote: `${note} Collect the payment on the day.` }, $unset: { chargeStartedAt: '' } }
);

const markPaid = (booking, amount, paymentIntentId) => Bookings.updateOne(
    { _id: booking._id, paymentStatus: 'charging' },
    {
        $set: { paymentStatus: 'paid', paidAt: new Date(), amountPaid: amount, ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }) },
        $unset: { chargeStartedAt: '', paymentNote: '' },
    }
);

// Takes a booking from card_saved (or a stale charging) to charging, in one step that only one
// caller can win. Returns the claimed booking, or null if someone else has it or it changed.
const claim = (booking, now) => Bookings.findOneAndUpdate(
    {
        _id: booking._id,
        status: { $ne: 'cancelled' },
        $or: [
            { paymentStatus: 'card_saved' },
            { paymentStatus: 'charging', chargeStartedAt: { $lte: new Date(now.getTime() - RETRY_AFTER_MINUTES * 60000) } },
        ],
    },
    { $set: { paymentStatus: 'charging', chargeStartedAt: now }, $inc: { chargeAttempts: 1 } },
    { new: true }
);

// Charges one claimed booking. Returns { outcome: 'paid' | 'failed' | 'retry', booking, amount, reason }
const chargeOne = async (booking, prices) => {
    const amount = bookingValue(booking, prices);
    if (amount === null) {
        await markUnpaid(booking, 'No prices were set, so the amount was unknown and it was not charged.');
        return { outcome: 'failed', booking, reason: 'no prices' };
    }
    if (amount === 0) {
        await markPaid(booking, 0, null);
        return { outcome: 'paid', booking, amount };
    }
    if (!booking.stripeCustomerId || !booking.stripePaymentMethodId) {
        await markUnpaid(booking, 'There is no saved card.');
        return { outcome: 'failed', booking, reason: 'no card' };
    }

    try {
        // A charge that was started before (the server stopped half way) is looked up, not repeated
        const intent = booking.stripePaymentIntentId
            ? await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId)
            : await stripe.paymentIntents.create({
                amount,
                currency: 'gbp',
                customer: booking.stripeCustomerId,
                payment_method: booking.stripePaymentMethodId,
                off_session: true, // the customer agreed when saving the card, and isn't here now
                confirm: true,
                receipt_email: booking.email || undefined,
                description: `Sark Boat Trips ${booking.charter === 'true' ? 'charter' : 'trip'} ${booking.timeslot} ${showDay(booking.date)}`,
                metadata: { bookingId: String(booking._id) },
            }, { idempotencyKey: `charge_booking_${booking._id}` });

        if (intent.status === 'succeeded') {
            await markPaid(booking, amount, intent.id);
            return { outcome: 'paid', booking, amount };
        }
        if (intent.status === 'processing') {
            // Rare for cards: keep it as charging, and look it up again on a later check
            await Bookings.updateOne({ _id: booking._id }, { $set: { stripePaymentIntentId: intent.id } });
            return { outcome: 'retry', booking, amount };
        }
        const reason = reasonFor(intent.last_payment_error);
        await markUnpaid(booking, reason);
        return { outcome: 'failed', booking, amount, reason };
    } catch (error) {
        if (error.type === 'StripeCardError' || error.code === 'authentication_required') {
            const reason = reasonFor(error);
            await markUnpaid(booking, reason);
            return { outcome: 'failed', booking, amount, reason };
        }
        // Stripe unreachable or busy: leave it as charging, and try again after RETRY_AFTER_MINUTES
        console.error(`Charging booking ${booking._id} failed for now (attempt ${booking.chargeAttempts}):`, error.message);
        if (booking.chargeAttempts >= MAX_ATTEMPTS) {
            const reason = 'Stripe could not be reached after several tries.';
            await markUnpaid(booking, reason);
            return { outcome: 'failed', booking, amount, reason };
        }
        return { outcome: 'retry', booking, amount };
    }
};

// Plain text on purpose: this one is for the owner and needs no layout
const failedChargesEmail = (failures) => ({
    from: settings.mail.sender,
    to: settings.mail.owner,
    subject: `Card payment failed for ${failures.length} booking${failures.length === 1 ? '' : 's'}: collect on the day`,
    text: `These bookings could not be charged to the customer's saved card. They are marked Unpaid on the dashboard.
Please take the payment on the day (cash or card reader) and press Mark paid.

Open the dashboard: ${settings.dashboardUrl}

${failures.map(({ booking, amount, reason }) => `- ${[booking.firstName, booking.lastName].filter(Boolean).join(' ')}, ${booking.timeslot} on ${showDay(booking.date)}, ${partyText(booking)}${amount ? `, ${pounds(amount)}` : ''}
  ${reason}${booking.phone ? `\n  Phone: ${booking.phone}` : ''}`).join('\n')}`,
});

// Charges every booking whose trip has started, that has a saved card and isn't cancelled
const runDueCharges = async (now = new Date()) => {
    const candidates = await Bookings.find({
        paymentStatus: { $in: ['card_saved', 'charging'] },
        status: { $ne: 'cancelled' },
        date: { $lte: guernseyToday(now) },
    });
    const due = candidates.filter((b) => tripStartsAt(b.date, b.timeslot).getTime() <= now.getTime());
    if (!due.length) return { paid: 0, failed: 0, retry: 0 };

    const prices = await readPrices();
    const results = [];
    for (const candidate of due) {
        const booking = await claim(candidate, now);
        if (booking) results.push(await chargeOne(booking, prices));
    }

    const failures = results.filter((r) => r.outcome === 'failed');
    if (failures.length) await trySend(failedChargesEmail(failures));
    const count = (outcome) => results.filter((r) => r.outcome === outcome).length;
    return { paid: count('paid'), failed: failures.length, retry: count('retry') };
};

// Started by index.js once the database is connected. Never overlaps itself.
const startChargeTimer = (everyMs = 60000) => {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const result = await runDueCharges();
            if (result.paid || result.failed) console.log(`Card charges: ${result.paid} paid, ${result.failed} failed`);
        } catch (error) {
            console.error('Card charge check failed:', error.message);
        } finally {
            running = false;
        }
    };
    tick();
    return setInterval(tick, everyMs);
};

module.exports = { runDueCharges, startChargeTimer, RETRY_AFTER_MINUTES, MAX_ATTEMPTS };
