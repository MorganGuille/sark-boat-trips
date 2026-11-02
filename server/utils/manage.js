// "Manage my booking" (spec P2-6): the rules for what a customer can do from the link in their emails.
// Owner's decisions (1 Nov 2026): up to the free-cancellation deadline they can cancel, or add or
// remove people (adding needs the seats); a different day or time goes through the owner (they send a
// message). After the deadline the page only shows how to get in touch. Every change emails the owner.
const Bookings = require('../models/bookings');
const { FREE_CANCEL_HOURS } = require('./policy');
const { guernseyNow } = require('./validateBooking');
const { longDay } = require('./dates');
const { settings } = require('./settings');
const { newManageToken, newReference } = require('./bookingCodes');

// A paid booking (or one being charged right now, or one a gift voucher pays towards) is never changed
// by the customer: the owner sorts it out
const CHANGEABLE = ['unpaid', 'card_saved'];
const changeablePayment = { paymentStatus: { $in: [...CHANGEABLE, null] }, 'voucher.code': { $exists: false } }; // null: no paymentStatus, which counts as unpaid

const manageUrl = (booking) => (booking.manageToken && settings.publicUrl ? `${settings.publicUrl}/manage/${booking.manageToken}` : null);

// When free cancellation ends: 24 hours before a trip starts, 48 before a charter (utils/policy.js).
// If the owner has moved the trip to another time, the terms let customers who can't make it cancel
// free, so then it lasts until the trip starts. trip: from getTrip (it knows the time that day).
const freeUntil = (booking, trip) => {
    if (!trip?.startsAt) return null;
    if (trip.timeChanged) return trip.startsAt;
    const hours = booking.charter === 'true' ? FREE_CANCEL_HOURS.charter : FREE_CANCEL_HOURS.trip;
    return new Date(trip.startsAt.getTime() - hours * 60 * 60 * 1000);
};

// What the customer may still do themselves. why says what stops them: cancelled, started, paid or deadline.
const whatCanChange = (booking, trip, now = new Date()) => {
    if (booking.status === 'cancelled') return { canChange: false, why: 'cancelled' };
    if (!trip?.startsAt || trip.startsAt <= now) return { canChange: false, why: 'started' };
    if (!CHANGEABLE.includes(booking.paymentStatus || 'unpaid') || booking.voucher?.code) return { canChange: false, why: 'paid' };
    if (now >= freeUntil(booking, trip)) return { canChange: false, why: 'deadline' };
    return { canChange: true, why: null };
};

// A moment in words, in Guernsey time: "11am on Sunday 8 November 2026"
const momentText = (moment) => {
    const { timeLabel } = require('./trips'); // here, not at the top: trips.js loads this file
    const { day, minutes } = guernseyNow(moment);
    const date = `${Math.floor(day / 10000)}-${String(Math.floor(day / 100) % 100).padStart(2, '0')}-${String(day % 100).padStart(2, '0')}`;
    return `${timeLabel(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)} on ${longDay(date)}`;
};

// Bookings made before these codes existed (or put in straight to the database) get them the first
// time an email is built for them, so every customer email can carry the link. Safe to call twice at
// once: only one set of codes is ever kept.
const ensureManageLinks = async (bookings) => {
    for (const booking of bookings) {
        if (booking.manageToken || !booking._id) continue;
        const saved = await Bookings.findOneAndUpdate(
            { _id: booking._id, manageToken: { $exists: false } },
            { $set: { manageToken: newManageToken(), reference: newReference() } },
            { new: true }
        ) || await Bookings.findById(booking._id);
        if (!saved) continue;
        booking.manageToken = saved.manageToken;
        booking.reference = saved.reference;
    }
};

module.exports = { CHANGEABLE, changeablePayment, manageUrl, freeUntil, whatCanChange, momentText, ensureManageLinks };
