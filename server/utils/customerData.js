// Customer data tools (spec P2-13, owner's choices 3 Nov 2026): everything held for one email address,
// to show the owner, download for the customer, or erase on request.
// Erasing blanks the person's details but keeps each booking's date, party and money, so past reports
// and income stay right; their saved card is removed at Stripe too. It is refused while they have a
// booking today or later (cancel it first), or a gift voucher still waiting to be emailed to them.
const Bookings = require('../models/bookings');
const Vouchers = require('../models/vouchers');
const stripe = require('./stripe');
const { settings } = require('./settings');
const { newManageToken } = require('./bookingCodes');
const { guernseyToday } = require('./validateBooking');
const { tripsFor, tripOfBooking } = require('./trips');
const { MAX_SEND_ATTEMPTS } = require('./vouchers');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tidyEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const isEmail = (value) => EMAIL.test(tidyEmail(value)) && tidyEmail(value).length <= 254;

// The field matches the address, ignoring capitals and spaces around it (never as a pattern)
const sameEmail = (field, email) => ({ $expr: { $eq: [{ $toLower: { $trim: { input: { $ifNull: [`$${field}`, ''] } } } }, email] } });

const find = async (email) => {
    const bookings = await Bookings.find(sameEmail('email', email)).sort({ date: 1 });
    const vouchers = await Vouchers.find({ $or: ['buyerEmail', 'recipientEmail', 'deliverTo'].map((field) => sameEmail(field, email)) }).sort({ createdAt: 1 });
    return { bookings, vouchers };
};

// Why erasing isn't allowed yet, in words, or null
const eraseProblem = ({ bookings, vouchers }, email) => {
    const today = guernseyToday();
    const coming = bookings.filter((b) => b.status !== 'cancelled' && b.date >= today);
    if (coming.length) {
        return `They have ${coming.length === 1 ? 'a booking' : `${coming.length} bookings`} from today on (${coming.map((b) => b.reference || b.date).join(', ')}). Cancel ${coming.length === 1 ? 'it' : 'them'} first.`;
    }
    if (bookings.some((b) => b.paymentStatus === 'charging')) return 'A card charge is going through right now. Try again in a few minutes.';
    const waiting = vouchers.filter((v) => tidyEmail(v.deliverTo) === email && !v.sentAt && (v.sendAttempts || 0) < MAX_SEND_ATTEMPTS);
    if (waiting.length) return `A gift voucher (${waiting.map((v) => v.code).join(', ')}) is still waiting to be emailed to them. Erase after it has been sent.`;
    return null;
};

const madeAt = (doc) => doc._id.getTimestamp().toISOString();

// What the owner sees, and what the customer is sent: their own details, in plain fields
const summary = async ({ bookings, vouchers }) => {
    const trips = await tripsFor(bookings);
    return {
        bookings: bookings.map((b) => ({
            _id: String(b._id),
            reference: b.reference,
            madeAt: madeAt(b),
            date: b.date,
            trip: b.charter === 'true' ? `Private charter (${tripOfBooking(trips, b)?.label || b.timeslot})` : (tripOfBooking(trips, b)?.label || b.timeslot),
            firstName: b.firstName, lastName: b.lastName, email: b.email, phone: b.phone, message: b.message,
            adults: b.adults, children: b.children, infants: b.infants,
            status: b.status || 'active', cancelledAt: b.cancelledAt,
            paymentStatus: b.paymentStatus || 'unpaid', amountPaid: b.amountPaid, card: b.cardLabel,
            giftVoucher: b.voucher?.code,
        })),
        vouchers: vouchers.map((v) => ({
            code: v.code, madeAt: madeAt(v), kind: v.kind, adults: v.adults, children: v.children,
            buyerName: v.buyerName, buyerEmail: v.buyerEmail, recipientName: v.recipientName, recipientEmail: v.recipientEmail,
            message: v.message, emailedTo: v.deliverTo, sentAt: v.sentAt, expiresOn: v.expiresOn, status: v.status,
            paidBy: v.paidBy, amountPaid: v.amountPaid,
        })),
    };
};

// Blanks the person's details everywhere. Stripe first: if their card can't be removed nothing is
// changed, so the owner can simply try again (the Stripe ids would be gone after blanking).
const erase = async (email, found) => {
    const customerIds = [...new Set(found.bookings.map((b) => b.stripeCustomerId).filter(Boolean))];
    let stripeNote = null;
    if (customerIds.length && settings.stripe.problem) {
        stripeNote = `Online payments are switched off here, so remove their card in the Stripe dashboard yourself (customer ${customerIds.join(', ')}).`;
    } else {
        for (const id of customerIds) {
            try {
                await stripe.customers.del(id);
            } catch (error) {
                if (error.type === 'StripeInvalidRequestError' && /no such customer/i.test(error.message)) continue; // already gone
                console.error('Removing a Stripe customer failed:', error.message);
                return { ok: false, problem: "Couldn't reach Stripe to remove their saved card, so nothing was erased. Try again in a few minutes." };
            }
        }
    }

    const erasedAt = new Date();
    for (const booking of found.bookings) {
        await Bookings.updateOne({ _id: booking._id }, {
            $set: { firstName: 'Erased', lastName: '', email: '', phone: '', message: '', manageToken: newManageToken(), erasedAt },
            $unset: { stripeCustomerId: '', stripePaymentMethodId: '', cardLabel: '' },
        });
    }
    for (const voucher of found.vouchers) {
        const set = { erasedAt };
        if (tidyEmail(voucher.buyerEmail) === email) Object.assign(set, { buyerName: '', buyerEmail: '', message: '' });
        if (tidyEmail(voucher.recipientEmail) === email || tidyEmail(voucher.deliverTo) === email) {
            Object.assign(set, { recipientName: '', recipientEmail: '', message: '' });
        }
        if (tidyEmail(voucher.deliverTo) === email) set.deliverTo = '';
        await Vouchers.updateOne({ _id: voucher._id }, { $set: set });
    }
    return { ok: true, bookings: found.bookings.length, vouchers: found.vouchers.length, cards: customerIds.length, stripeNote };
};

module.exports = { tidyEmail, isEmail, find, eraseProblem, summary, erase };
