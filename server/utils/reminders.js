// The reminder email at 6pm (Guernsey time) the evening before each trip (spec P2-7). index.js runs
// this every minute; the tests call runDueReminders with a fixed clock. Owner's decisions (30 Oct 2026):
// every booking with an email gets one, online or dashboard, trip or charter; a booking made after 6pm
// for the next day doesn't (it has only just had its confirmation); no payment line.
const Bookings = require('../models/bookings');
const { guernseyNow } = require('./validateBooking');
const { trySend } = require('./mailer');
const { reminderEmail } = require('../emails');
const { repeat } = require('./timer');

const REMINDER_HOUR = 18; // 6pm the evening before, Guernsey time
const MAX_ATTEMPTS = 3; // a reminder that fails to send is tried again a minute later, this many times in all

// 'YYYY-MM-DD' for the day after a yyyymmdd number
const dayAfter = (day) => new Date(Date.UTC(Math.floor(day / 10000), (Math.floor(day / 100) % 100) - 1, (day % 100) + 1)).toISOString().slice(0, 10);

// Was the booking made before 6pm today (Guernsey)? Its id records when it was created.
const madeBeforeReminderTime = (booking, today) => {
    const made = guernseyNow(booking._id.getTimestamp());
    return made.day < today || (made.day === today && made.minutes < REMINDER_HOUR * 60);
};

// Sends tomorrow's reminders, once each, from 6pm until midnight
const runDueReminders = async (now = new Date()) => {
    const { day: today, minutes } = guernseyNow(now);
    if (minutes < REMINDER_HOUR * 60) return { sent: 0, failed: 0 };

    const notYet = {
        date: dayAfter(today),
        status: { $ne: 'cancelled' },
        email: { $nin: [null, ''] },
        reminderSentAt: { $exists: false },
        $or: [{ reminderAttempts: { $exists: false } }, { reminderAttempts: { $lt: MAX_ATTEMPTS } }],
    };
    const due = (await Bookings.find(notYet)).filter((b) => madeBeforeReminderTime(b, today));

    let sent = 0, failed = 0;
    for (const candidate of due) {
        // Claimed first, so two checks running at once can't both send it
        const booking = await Bookings.findOneAndUpdate(
            { ...notYet, _id: candidate._id },
            { $set: { reminderSentAt: now }, $inc: { reminderAttempts: 1 } },
            { new: true }
        );
        if (!booking) continue;
        if (await trySend(reminderEmail(booking))) {
            sent++;
        } else {
            failed++;
            await Bookings.updateOne({ _id: booking._id }, { $unset: { reminderSentAt: '' } });
        }
    }
    return { sent, failed };
};

// Started by index.js once the database is connected
const startReminderTimer = (everyMs = 60000) => repeat('Reminder', async () => {
    const result = await runDueReminders();
    if (result.sent || result.failed) console.log(`Reminders: ${result.sent} sent, ${result.failed} failed`);
}, everyMs);

module.exports = { runDueReminders, startReminderTimer, REMINDER_HOUR, MAX_ATTEMPTS };
