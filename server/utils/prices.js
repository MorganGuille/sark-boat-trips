// Ticket prices. The owner sets them in the dashboard and they are kept (in pence, so there are no
// rounding errors) on the single settings document that also holds the season dates. Infants are free.
// Every booking saves the prices in force when it was made, so a later price change never alters an
// old booking or last year's income.
const Admin = require('../models/admin');

const KEYS = ['adult', 'child', 'charter'];
const MAX_POUNDS = 10000;

// Pounds as typed ('40', 12.5, '12.50') become whole pence, or null if it isn't a sensible price
const toPence = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value).trim();
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(text) || Number(text) > MAX_POUNDS) return null;
    return Math.round(Number(text) * 100);
};

// { adult, child, charter } in pence, or null if the owner hasn't set all three yet
const readPrices = async () => {
    const doc = await Admin.findOne();
    if (!doc) return null;
    const prices = { adult: doc.adultPrice, child: doc.childPrice, charter: doc.charterPrice };
    return KEYS.every((key) => Number.isInteger(prices[key])) ? prices : null;
};

const hasPrices = (prices) => Boolean(prices) && KEYS.every((key) => Number.isInteger(prices[key]));

// What a booking is worth, in pence (infants are free): the flat charter price, or adults and children at their own
// prices. It uses the prices saved on the booking, or the current ones for a booking that has none.
// Returns null if no prices are known at all. A gift voucher used for the booking is taken off (the
// voucher's money came in when it was sold), so this is what is still to be charged or collected.
const fullValue = (booking, current) => {
    const prices = hasPrices(booking.prices) ? booking.prices : current;
    if (!hasPrices(prices)) return null;
    if (booking.charter === 'true') return prices.charter;
    return (Number(booking.adults) || 0) * prices.adult + (Number(booking.children) || 0) * prices.child;
};
const bookingValue = (booking, current) => {
    const value = fullValue(booking, current);
    return value === null ? null : Math.max(0, value - (Number(booking.voucher?.value) || 0));
};

// The prices a new booking on this trip saves (booking.prices): an extra trip's own adult and child
// prices (it is never a charter), otherwise today's prices (null if they aren't set).
const pricesFor = (trip, current) => {
    if (!trip?.extra) return current;
    return { adult: trip.prices.adult, child: trip.prices.child, charter: current?.charter ?? 0 };
};

module.exports = { toPence, readPrices, hasPrices, bookingValue, fullValue, pricesFor };
