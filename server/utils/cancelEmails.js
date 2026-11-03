// The emails after the owner cancels a booking on the dashboard wait about a minute (spec P3-6, owner's
// choice 3 Nov 2026), so Undo can put the booking back before the customer hears anything. The booking
// is cancelled at once (its seats free up and its card won't be charged); only the emails wait, in
// cancelEmailDueAt, so a restart doesn't lose them. index.js runs this every minute; the tests call
// runDueCancelEmails with a fixed clock. Restoring (Undo) clears cancelEmailDueAt in the same database
// step that makes the booking active again, so either the emails go or the restore is quiet, never both.
const Bookings = require('../models/bookings');
const { trySend } = require('./mailer');
const emails = require('../emails');
const { withTrip } = require('./trips');
const { repeat } = require('./timer');

const CANCEL_EMAIL_DELAY_MS = 60 * 1000; // the Undo bar shows for 30 seconds, well inside this
const MAX_ATTEMPTS = 3; // a customer email that fails is tried again a minute later, this many times in all

const emailsDue = (now) => new Date(now.getTime() + CANCEL_EMAIL_DELAY_MS);

// Sends the customer's email (if they have an address) and, once that is settled, the owner's.
// Returns false only when the customer's email failed and should be tried again.
const sendCancelEmails = async (booking, { lastTry = true } = {}) => {
    const forEmail = await withTrip(booking);
    const customerOk = booking.email ? await trySend(emails.cancellationEmail(forEmail)) : true;
    if (!customerOk && !lastTry) return false;
    await trySend(emails.cancelledOwnerEmail(forEmail, { customerEmailFailed: !customerOk }));
    return true;
};

const runDueCancelEmails = async (now = new Date()) => {
    const waiting = { status: 'cancelled', cancelEmailDueAt: { $lte: now } };
    const due = await Bookings.find(waiting, { _id: 1 });

    let sent = 0, failed = 0;
    for (const { _id } of due) {
        // Claimed first, so two checks (or an Undo) at the same moment can't both act on it
        const booking = await Bookings.findOneAndUpdate(
            { ...waiting, _id },
            { $unset: { cancelEmailDueAt: '' }, $inc: { cancelEmailAttempts: 1 } },
            { new: true }
        );
        if (!booking) continue;
        if (await sendCancelEmails(booking, { lastTry: booking.cancelEmailAttempts >= MAX_ATTEMPTS })) {
            sent++;
        } else {
            failed++;
            await Bookings.updateOne({ _id, status: 'cancelled' }, { $set: { cancelEmailDueAt: now } });
        }
    }
    return { sent, failed };
};

// Started by index.js once the database is connected
const startCancelEmailTimer = (everyMs = 60000) => repeat('Cancellation email', async () => {
    const result = await runDueCancelEmails();
    if (result.failed) console.log(`Cancellation emails: ${result.sent} sent, ${result.failed} failed (tried again in a minute)`);
}, everyMs);

module.exports = { runDueCancelEmails, startCancelEmailTimer, sendCancelEmails, emailsDue, CANCEL_EMAIL_DELAY_MS, MAX_ATTEMPTS };
