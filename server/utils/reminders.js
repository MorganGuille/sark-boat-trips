// The reminder email at 6pm (Guernsey time) the evening before each trip (spec P2-7). index.js runs
// this every minute; the tests call runDueReminders with a fixed clock. Owner's decisions (30 Oct 2026):
// every booking with an email gets one, online or dashboard, trip or charter; a booking made after 6pm
// for the next day doesn't (it has only just had its confirmation); no payment line.
const Bookings = require('../models/bookings');
const { guernseyNow } = require('./validateBooking');
const { showDay } = require('./dates');
const { partyText } = require('./party');
const { trySend } = require('./mailer');
const { safeHtml } = require('./safeHtml');
const { settings } = require('./settings');
const { repeat } = require('./timer');

const REMINDER_HOUR = 18; // 6pm the evening before, Guernsey time
const MAX_ATTEMPTS = 3; // a reminder that fails to send is tried again a minute later, this many times in all

// 'YYYY-MM-DD' for the day after a yyyymmdd number
const dayAfter = (day) => new Date(Date.UTC(Math.floor(day / 10000), (Math.floor(day / 100) % 100) - 1, (day % 100) + 1)).toISOString().slice(0, 10);

const reminderEmail = (booking) => {
    const what = booking.charter === 'true' ? 'private charter' : 'boat trip';
    return {
        from: settings.mail.sender,
        to: booking.email,
        subject: `See you tomorrow at ${booking.timeslot} - Sark Boat Trips`,
        html: safeHtml`<div style="background-color: rgb(63, 78, 90); width: 100%; height: 100%; display: flex;">
                <div style="font-family: sans-serif; text-align: left; width: 20rem; height: 80%; margin: 4rem auto 4rem auto; background-color: rgb(64, 94, 119); color: white; padding: 2rem; border-radius: 2rem;">
                <h3>Dear ${booking.firstName || 'guest'},</h3>
                <p>Just a reminder that your ${what} is <strong>tomorrow, ${showDay(booking.date)}, at ${booking.timeslot}</strong>${booking.charter === 'true' ? '' : `, for ${partyText(booking)}`}.</p>
                <p>Please be at the <strong>Creux Harbour</strong> shortly before ${booking.timeslot}, and bring weather appropriate clothing and any snacks and drinks you'd like.</p>
                <p>If the weather means we have to change the time or cancel, we will contact you.</p>
                <p>If you can no longer come, please let us know as soon as possible.</p>
                <p>See you tomorrow!</p>
                <h3>Sark Boat Trips</h3>
                <hr>
                <br>
                <div style="text-align: center;">
                <a style="color: white; text-decoration: none; margin: 0; padding: 0;"
                    href="https://maps.app.goo.gl/E2XLJqrGku7eDePZ8" target='_blank'>&#9875 Creux Harbour, Sark</a>
                <br>
                <a style="color: white; text-decoration: none;" href="tel:+44-7911-764-246">&#9990 +44 7911 764 246</a>
                <br>
                <a style="color: white; text-decoration: none;" href="mailto:${settings.mail.from}">&#9993
                    ${settings.mail.from}</a>
                </div>
            </div>
        </div>`,
    };
};

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

module.exports = { runDueReminders, startReminderTimer, reminderEmail, REMINDER_HOUR, MAX_ATTEMPTS };
