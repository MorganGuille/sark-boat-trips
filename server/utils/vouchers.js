// Gift vouchers (owner's decisions, 2 Nov 2026): for people on a trip, at the normal prices, or for a
// private charter. Valid until the end of next season, which always ends by 1 October. Not refundable,
// but they can be passed on. Bought online (controllers/vouchers.js) or made on the dashboard; used by
// the owner, who books the person in and marks the voucher used against that booking.
const crypto = require('crypto');
const Admin = require('../models/admin');
const Vouchers = require('../models/vouchers');
const { isDay, dayNumber, longDay } = require('./dates');
const { partyText } = require('./party');
const { fullValue, hasPrices } = require('./prices');
const { guernseyNow, guernseyToday } = require('./validateBooking');
const { trySend } = require('./mailer');
const { repeat } = require('./timer');

const SEASON_ENDS = '10-01'; // the season always ends by 1 October (owner): a voucher lasts until then
const MAX_PEOPLE = 12; // the boat's limit
const SEND_HOUR = 8; // a voucher set for a later day is emailed at 8am that day, Guernsey time
const MAX_SEND_ATTEMPTS = 3; // a voucher email that fails is tried again a minute later, this many times in all
const MAX_LENGTH = { recipientName: 100, buyerName: 100, buyerEmail: 254, recipientEmail: 254, message: 300 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_LETTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out on the phone
const newVoucherCode = () => {
    const letters = Array.from(crypto.randomBytes(6), (byte) => CODE_LETTERS[byte % CODE_LETTERS.length]).join('');
    return `GIFT-${letters.slice(0, 4)}-${letters.slice(4)}`;
};
// What the owner types into the dashboard: any case, spaces or no dashes
const tidyCode = (value) => {
    const letters = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GIFT/, '');
    return letters.length === 6 ? `GIFT-${letters.slice(0, 4)}-${letters.slice(4)}` : null;
};

// The last day a voucher bought on `today` can be used: 1 October of the first season that hasn't
// started yet. seasonStart is the season on the dashboard ('YYYY-MM-DD', or null).
//   bought at Christmas 2026, or in July 2026 during the season: 1 October 2027
//   bought in February 2027, before the 2027 season opens: 1 October 2027
// The dashboard holds one season at a time, so a season start in an earlier year means this year's
// hasn't been set yet, so it hasn't opened (unless it's already past 1 October).
const voucherExpiry = (today, seasonStart) => {
    const year = Number(today.slice(0, 4));
    const endOf = (y) => `${y}-${SEASON_ENDS}`;
    if (isDay(seasonStart)) {
        if (seasonStart > today) return endOf(Number(seasonStart.slice(0, 4)));
        if (Number(seasonStart.slice(0, 4)) < year && today < endOf(year)) return endOf(year);
    }
    return endOf(year + 1);
};

const seasonStartOnDashboard = async () => {
    const doc = await Admin.findOne();
    return doc?.seasonStartDate ? doc.seasonStartDate.toISOString().slice(0, 10) : null;
};
const expiryForToday = async (now = new Date()) => voucherExpiry(guernseyToday(now), await seasonStartOnDashboard());

const isExpired = (voucher, now = new Date()) => dayNumber(voucher.expiresOn) < guernseyNow(now).day;

// 'Private charter for up to 12 people', '2 adults and 1 child', '1 child'
const coversText = (voucher) => {
    if (voucher.kind === 'charter') return `Private charter for up to ${MAX_PEOPLE} people`;
    if (voucher.adults) return partyText({ adults: voucher.adults, children: voucher.children });
    return `${voucher.children} ${voucher.children === 1 ? 'child' : 'children'}`;
};
// The same, short, for subject lines and the dashboard: 'a private charter', '2 adults and 1 child'
const coversShort = (voucher) => (voucher.kind === 'charter' ? 'a private charter' : coversText(voucher));

// What a voucher costs at these prices (pence), or null if they aren't set
const voucherPrice = (voucher, prices) => {
    if (!prices) return null;
    if (voucher.kind === 'charter') return prices.charter;
    return voucher.adults * prices.adult + voucher.children * prices.child;
};

// How much of a booking a voucher pays for, at the booking's own prices: the charter price, or the
// adults and children it covers who are on the booking. A voucher for more people than came only
// covers those who did. Returns pence, or a reason it can't be used for this booking.
const coverFor = (voucher, booking, prices) => {
    const charter = booking.charter === 'true';
    if (voucher.kind === 'charter' && !charter) return { problem: 'This is a charter voucher, and that booking is not a charter.' };
    if (voucher.kind === 'trip' && charter) return { problem: "This voucher is for people on a trip, and that booking is a charter. Use a charter voucher, or don't link it to the booking." };
    if (!prices) return { problem: 'Set your prices first, so the voucher can be valued.' };
    if (charter) return { value: prices.charter };
    const adults = Math.min(voucher.adults, Number(booking.adults) || 0);
    const children = Math.min(voucher.children, Number(booking.children) || 0);
    if (!adults && !children) return { problem: `That booking has nobody this voucher covers (it covers ${coversText(voucher)}).` };
    return { value: adults * prices.adult + children * prices.child };
};

// After the owner edits a booking that has a voucher on it (more or fewer people, another kind of
// booking, other prices): what the voucher covers is worked out again, so people it covers aren't
// charged and people it doesn't cover are. A booking it paid for in full that now has something left
// to pay goes back to how it was paid before (a saved card is charged at the trip time), and one it
// now pays for in full becomes 'voucher'. Changes the booking (not saved here) and returns
// { code, value, left } in pence, or null if nothing can be worked out. Only for a booking that isn't
// paid or being charged.
const reapplyVoucher = async (booking, currentPrices) => {
    const prices = hasPrices(booking.prices) ? booking.prices : currentPrices;
    const full = fullValue(booking, currentPrices);
    const voucher = await Vouchers.findOne({ code: booking.voucher.code });
    if (!voucher || full === null) return null;
    const cover = coverFor(voucher, booking, prices);
    const value = cover.problem ? 0 : Math.min(cover.value, full); // it may no longer cover anyone on the booking
    booking.voucher.value = value;
    const paysAll = full > 0 && value >= full;
    if (paysAll && booking.paymentStatus !== 'voucher') {
        booking.voucher.previousStatus = booking.paymentStatus || 'unpaid';
        booking.paymentStatus = 'voucher';
    } else if (!paysAll && booking.paymentStatus === 'voucher') {
        booking.paymentStatus = booking.voucher.previousStatus === 'card_saved' && booking.stripePaymentMethodId ? 'card_saved' : 'unpaid';
    }
    return { code: voucher.code, value, left: full - value };
};

const count = (value) => (value === undefined || value === null || String(value).trim() === '' ? 0 : Number(value));
const isWhole = (value) => (typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value).trim());
const blank = (value) => value == null || String(value).trim() === '';

// Checks a voucher order (online, or the owner's on the dashboard). Returns a problem in words, or null.
// Online, the buyer's name and email and who it's for are required; on the dashboard nothing is,
// except what it covers.
const voucherProblem = (body, { owner = false, now = new Date() } = {}) => {
    for (const [key, max] of Object.entries(MAX_LENGTH)) {
        const value = body[key];
        if (value != null && typeof value !== 'string') return 'Please check the details and try again.';
        if (value && value.length > max) return `Please keep that shorter (${max} characters at most).`;
    }
    if (!['trip', 'charter'].includes(body.kind)) return 'Please choose a voucher.';
    if (body.kind === 'trip') {
        for (const key of ['adults', 'children']) {
            if (!blank(body[key]) && !isWhole(body[key])) return 'Please choose how many people.';
        }
        const people = count(body.adults) + count(body.children);
        if (people < 1) return 'Please choose at least one person.';
        if (people > MAX_PEOPLE) return `A voucher can be for up to ${MAX_PEOPLE} people. For a bigger group, please contact us.`;
    }
    if (!owner) {
        if (blank(body.recipientName)) return 'Please tell us who the voucher is for.';
        if (blank(body.buyerName)) return 'Please enter your name.';
        if (blank(body.buyerEmail)) return 'Please enter your email address.';
    }
    if (!blank(body.buyerEmail) && !EMAIL.test(body.buyerEmail.trim())) return 'Please enter a valid email address.';
    if (!blank(body.recipientEmail) && !EMAIL.test(body.recipientEmail.trim())) return "Please enter a valid email address for the person it's for.";
    if (body.sendTo === 'recipient' && blank(body.recipientEmail)) return "Please enter the email address of the person it's for.";
    if (!blank(body.sendOn)) {
        if (!isDay(body.sendOn)) return 'Please choose a valid day to send it.';
        const today = guernseyNow(now).day;
        if (dayNumber(body.sendOn) < today) return 'That day has already passed. Please choose another, or send it now.';
        if (dayNumber(body.sendOn) > today + 10000) return 'Please choose a day within the next year.';
    }
    return null;
};

// The voucher's own fields from an order (strings trimmed, numbers as numbers)
const fromOrder = (body) => {
    const text = (value) => (blank(value) ? undefined : String(value).trim());
    const sendTo = body.sendTo === 'recipient' ? 'recipient' : 'buyer';
    const fields = {
        kind: body.kind,
        adults: body.kind === 'trip' ? count(body.adults) : 0,
        children: body.kind === 'trip' ? count(body.children) : 0,
        recipientName: text(body.recipientName),
        message: text(body.message),
        buyerName: text(body.buyerName),
        buyerEmail: text(body.buyerEmail),
        recipientEmail: text(body.recipientEmail),
        sendOn: sendTo === 'recipient' ? text(body.sendOn) : undefined,
    };
    fields.deliverTo = sendTo === 'recipient' ? fields.recipientEmail : fields.buyerEmail;
    return fields;
};

// Makes a voucher with a code no other voucher has
const createVoucher = async (fields) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await Vouchers.create({ ...fields, code: newVoucherCode() });
        } catch (error) {
            const codeTaken = error.code === 11000 && error.keyPattern?.code;
            if (!codeTaken || attempt >= 5) throw error;
        }
    }
};

// Is it time to email this voucher? Straight away, or from 8am on the day the buyer chose.
const isDue = (voucher, now = new Date()) => {
    if (!voucher.sendOn) return true;
    const { day, minutes } = guernseyNow(now);
    return dayNumber(voucher.sendOn) < day || (dayNumber(voucher.sendOn) === day && minutes >= SEND_HOUR * 60);
};

// Emails the voucher (with its PDF) once. Claimed first, so two callers can't both send it; a failed
// send is let go to be tried again (up to MAX_SEND_ATTEMPTS). Returns true if it was sent now.
const deliverVoucher = async (voucher, now = new Date()) => {
    if (!voucher.deliverTo) return false;
    const notYet = { _id: voucher._id, sentAt: { $exists: false }, $or: [{ sendAttempts: { $exists: false } }, { sendAttempts: { $lt: MAX_SEND_ATTEMPTS } }] };
    const claimed = await Vouchers.findOneAndUpdate(notYet, { $set: { sentAt: now }, $inc: { sendAttempts: 1 } }, { new: true });
    if (!claimed) return false;
    const emails = require('../emails'); // here, not at the top: emails/index.js uses this file
    const { voucherPdf } = require('../emails/voucherPdf');
    if (await trySend(emails.voucherEmail(claimed, await voucherPdf(claimed)))) return true;
    await Vouchers.updateOne({ _id: claimed._id }, { $unset: { sentAt: '' } });
    if (claimed.sendAttempts >= MAX_SEND_ATTEMPTS) await trySend(emails.voucherNotSentOwnerEmail(claimed));
    return false;
};

// Emails the vouchers whose day has come (index.js runs this every minute; tests use a fixed clock)
const runDueVoucherEmails = async (now = new Date()) => {
    const waiting = await Vouchers.find({
        sentAt: { $exists: false },
        deliverTo: { $nin: [null, ''] },
        $or: [{ sendAttempts: { $exists: false } }, { sendAttempts: { $lt: MAX_SEND_ATTEMPTS } }],
    });
    let sent = 0, failed = 0;
    for (const voucher of waiting.filter((v) => isDue(v, now))) {
        if (await deliverVoucher(voucher, now)) sent++;
        else failed++;
    }
    return { sent, failed };
};

// Started by index.js once the database is connected
const startVoucherTimer = (everyMs = 60000) => repeat('Voucher email', async () => {
    const result = await runDueVoucherEmails();
    if (result.sent || result.failed) console.log(`Gift vouchers: ${result.sent} emailed, ${result.failed} failed`);
}, everyMs);

// 'Thursday 1 October 2027' for emails, the PDF and the dashboard
const validUntil = (voucher) => longDay(voucher.expiresOn);

module.exports = {
    SEASON_ENDS, SEND_HOUR, MAX_SEND_ATTEMPTS, newVoucherCode, tidyCode, voucherExpiry, expiryForToday, isExpired,
    coversText, coversShort, voucherPrice, coverFor, reapplyVoucher, voucherProblem, fromOrder, createVoucher, isDue, deliverVoucher,
    runDueVoucherEmails, startVoucherTimer, validUntil,
};
