// Longest allowed answer for each field. Everything a customer types ends up in emails and
// in Stripe, so keep it bounded.
const MAX_LENGTH = { date: 10, timeslot: 10, firstName: 100, lastName: 100, phone: 40, email: 254, accommodation: 200, message: 1000 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED = ['date', 'timeslot', 'firstName', 'lastName', 'phone', 'email'];

// Checks a booking made by a customer (never used for the dashboard, where details may be missing).
// Returns a message the customer can read, or null if the booking looks fine.
const validatePublicBooking = (body) => {
    const complete = REQUIRED.every((key) => typeof body[key] === 'string' && body[key].trim()) && Number(body.adults) >= 1;
    if (!complete) return 'Please fill in all the required fields.';

    if (!EMAIL.test(body.email.trim())) return 'Please enter a valid email address.';

    const tooLong = Object.entries(MAX_LENGTH).some(([key, max]) => body[key] != null && String(body[key]).length > max);
    if (tooLong) return 'One of your answers is too long. Please shorten it and try again.';

    return null;
};

module.exports = { validatePublicBooking };
