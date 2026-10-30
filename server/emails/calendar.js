// The "add to calendar" file attached to confirmations and changes (an .ics file: tapping it on a
// phone offers to add the trip to the calendar). Owner's lengths, 30 Oct 2026: a trip 2.5 hours, a
// charter 3. The same booking always has the same id inside the file, so a changed booking replaces
// the old calendar entry in most calendar apps instead of adding a second one.
const { partyText } = require('../utils/party');
const { settings } = require('../utils/settings');
const { describeTrip } = require('../utils/trips');
const { PHONE } = require('./layout');

const HOURS = { trip: 2.5, charter: 3 };

// Calendar files need commas, semicolons, backslashes and line breaks marked
const escapeText = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// 2026-11-09T11:00:00.000Z becomes 20261109T110000Z
const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Lines longer than 75 bytes are folded onto the next line, starting with a space
const fold = (line) => {
    const out = [];
    let current = '';
    for (const char of line) {
        if (Buffer.byteLength(current + char) > (out.length ? 74 : 75)) {
            out.push(current);
            current = '';
        }
        current += char;
    }
    out.push(current);
    return out.join('\r\n ');
};

// The attachment for nodemailer, or null if the booking has no valid date and time. The trip's time
// and harbour that day come from booking.trip (utils/trips.js withTrips), or are the usual ones.
const calendarFile = (booking, now = new Date()) => {
    let trip;
    try {
        trip = booking.trip || describeTrip(booking.date, booking.timeslot);
    } catch {
        return null; // not a trip time it knows
    }
    const start = trip.startsAt;
    if (!start || Number.isNaN(start.getTime())) return null;
    const charter = booking.charter === 'true';
    const end = new Date(start.getTime() + HOURS[charter ? 'charter' : 'trip'] * 3600000);
    const domain = settings.mail.from.split('@')[1] || 'sarkboattrips.com';
    const summary = charter ? 'Sark Boat Trips: private charter' : `Sark Boat Trips: boat trip (${partyText(booking)})`;
    const description = `Please be at the ${trip.harbour.name} shortly before ${trip.time}. Questions? Call ${PHONE} or email ${settings.mail.from}.`;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sark Boat Trips//Bookings//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:booking-${booking._id}@${domain}`,
        `DTSTAMP:${stamp(now)}`,
        // a later number tells calendar apps this replaces an earlier version of the same booking
        `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${escapeText(summary)}`,
        `LOCATION:${escapeText(`${trip.harbour.name}, Sark`)}`,
        `DESCRIPTION:${escapeText(description)}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return {
        filename: 'sark-boat-trip.ics',
        content: `${lines.map(fold).join('\r\n')}\r\n`,
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    };
};

module.exports = { calendarFile, HOURS };
