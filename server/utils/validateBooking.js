const Admin = require('../models/admin');

// Trip start times on a 24 hour clock. The timeslot names are what bookings store.
const TIMESLOTS = { '11am': 11, '2pm': 14 };
const MAX_PER_FIELD = 12; // adults, and children, each
const MAX_CAPACITY = 100;
const BOOKING_CUTOFF_MINUTES = 60; // customers can book online until this long before the trip starts
const TIMEZONE = 'Europe/Guernsey'; // the server runs in UTC, but trips and cutoffs are in local time

// Longest allowed answer for each field. Everything a customer types ends up in emails and
// in Stripe, so keep it bounded.
const MAX_LENGTH = { date: 10, timeslot: 10, firstName: 100, lastName: 100, phone: 40, email: 254, accommodation: 200, message: 1000 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED = ['date', 'timeslot', 'firstName', 'lastName', 'phone', 'email'];

const blank = (value) => value == null || String(value).trim() === '';
// Only real strings and numbers count: String(['15-06-2033']) looks like a valid date, but a list isn't one
const isWhole = (value) => (typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value).trim());
const isTimeslot = (value) => typeof value === 'string' && Object.hasOwn(TIMESLOTS, value);

// 'dd-mm-yyyy' becomes the number yyyymmdd (easy to compare), or null if it isn't a real date
const dayNumber = (value) => {
    if (typeof value !== 'string') return null;
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) return null;
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const real = new Date(Date.UTC(year, month - 1, day));
    if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
    return year * 10000 + month * 100 + day;
};

const prettyDay = (number) =>
    new Date(Date.UTC(Math.floor(number / 10000), (Math.floor(number / 100) % 100) - 1, number % 100))
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Today's date (as yyyymmdd) and the time (minutes since midnight) in Guernsey
const guernseyNow = (now = new Date()) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(now).map((part) => [part.type, part.value])
    );
    return {
        day: Number(parts.year) * 10000 + Number(parts.month) * 100 + Number(parts.day),
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
};

// Has the date passed, or has booking for this trip closed? (date and timeslot must already be valid)
const whenProblem = (date, timeslot, now = new Date()) => {
    const today = guernseyNow(now);
    const day = dayNumber(date);
    if (day < today.day) return 'That date has already passed.';
    if (day === today.day && today.minutes + BOOKING_CUTOFF_MINUTES > TIMESLOTS[timeslot] * 60) {
        return 'Online booking for that trip has closed. Please contact us to book.';
    }
    return null;
};

// season is { start, end } as yyyymmdd numbers, or null if the owner hasn't set one
const seasonProblem = (date, season) => {
    if (!season) return "Bookings aren't open yet. Please check back soon.";
    const day = dayNumber(date);
    if (day < season.start || day > season.end) {
        return `Bookings are only taken between ${prettyDay(season.start)} and ${prettyDay(season.end)}.`;
    }
    return null;
};

const loadSeason = async () => {
    const doc = await Admin.findOne();
    if (!doc) return null;
    const toNumber = (date) => Number(date.toISOString().slice(0, 10).replace(/-/g, ''));
    return { start: toNumber(doc.seasonStartDate), end: toNumber(doc.seasonEndDate) };
};

const partyProblem = (body, { adultsRequired }) => {
    if (!blank(body.adults)) {
        if (!isWhole(body.adults) || Number(body.adults) < 1 || Number(body.adults) > MAX_PER_FIELD) {
            return `Please enter between 1 and ${MAX_PER_FIELD} adults.`;
        }
    } else if (adultsRequired) {
        return `Please enter between 1 and ${MAX_PER_FIELD} adults.`;
    }
    if (!blank(body.children) && (!isWhole(body.children) || Number(body.children) > MAX_PER_FIELD)) {
        return `Please enter between 0 and ${MAX_PER_FIELD} children.`;
    }
    return null;
};

const textProblem = (body) => {
    if (Object.keys(MAX_LENGTH).some((key) => body[key] != null && typeof body[key] !== 'string')) return 'Please check your details and try again.';
    if (!blank(body.email) && (typeof body.email !== 'string' || !EMAIL.test(body.email.trim()))) return 'Please enter a valid email address.';
    const tooLong = Object.entries(MAX_LENGTH).some(([key, max]) => body[key] != null && String(body[key]).length > max);
    if (tooLong) return 'One of your answers is too long. Please shorten it and try again.';
    return null;
};

// Checks a booking made by a customer (never used for the dashboard, where details may be missing).
// Returns a message the customer can read, or null if the booking is fine.
const validatePublicBooking = async (body, now = new Date()) => {
    const complete = REQUIRED.every((key) => typeof body[key] === 'string' && body[key].trim()) && Number(body.adults) >= 1;
    if (!complete) return 'Please fill in all the required fields.';

    const problem = textProblem(body) || partyProblem(body, { adultsRequired: true });
    if (problem) return problem;

    if (!isTimeslot(body.timeslot)) return 'Please choose a valid trip time.';
    if (dayNumber(body.date) === null) return 'Please choose a valid date.';

    return whenProblem(body.date, body.timeslot, now) || seasonProblem(body.date, await loadSeason());
};

// Checks a booking entered on the dashboard. Details may be missing and past dates are fine, but
// whatever is given must make sense. With requireTrip the date and timeslot must be present
// (adding a booking); without it only the fields that are given are checked (editing one).
const validateAdminBooking = (body, { requireTrip = false } = {}) => {
    if ((requireTrip || !blank(body.date)) && dayNumber(body.date) === null) return 'Please enter a valid date (dd-mm-yyyy).';
    if ((requireTrip || !blank(body.timeslot)) && !isTimeslot(body.timeslot)) return 'Please choose a valid trip time.';
    if (!blank(body.charter) && !['true', 'false'].includes(body.charter)) return 'Invalid booking type.';
    return textProblem(body) || partyProblem(body, { adultsRequired: false });
};

// Checks the owner's "set capacity for this trip" request
const validateAvailabilitySetting = ({ date, timeslot, capacity }) => {
    if (dayNumber(date) === null) return 'Please choose a valid date.';
    if (!isTimeslot(timeslot)) return 'Please choose a valid trip time.';
    if (!isWhole(capacity) || Number(capacity) > MAX_CAPACITY) return `Capacity must be a whole number from 0 to ${MAX_CAPACITY}.`;
    return null;
};

module.exports = {
    validatePublicBooking, validateAdminBooking, validateAvailabilitySetting,
    // exported so the date and time rules can be tested with a fixed clock
    dayNumber, guernseyNow, whenProblem, seasonProblem, partyProblem, BOOKING_CUTOFF_MINUTES,
};
