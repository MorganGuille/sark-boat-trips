// Gift vouchers (utils/vouchers.js has the rules). Online: the buyer pays on Stripe's page straight
// away (mode 'payment', unlike bookings, which only save a card), and the voucher is made once Stripe
// says it's paid, by the webhook or the thank-you page, whichever comes first. Dashboard: the owner
// lists, makes (for bank transfers, cash or prizes), uses, undoes, resends, extends and prints them.
const mongoose = require('mongoose');
const Vouchers = require('../models/vouchers');
const Bookings = require('../models/bookings');
const { settings } = require('../utils/settings');
const { readPrices, fullValue, hasPrices, toPence } = require('../utils/prices');
const { isDay, showDay } = require('../utils/dates');
const { trySend } = require('../utils/mailer');
const {
    expiryForToday, isExpired, coversText, coversShort, voucherPrice, coverFor, voucherProblem, fromOrder, createVoucher,
    isDue, deliverVoucher, tidyCode, validUntil,
} = require('../utils/vouchers');
const emails = require('../emails');
const { voucherPdf } = require('../emails/voucherPdf');
const stripe = require('../utils/stripe');

const UNAVAILABLE = "Gift vouchers can't be bought online right now. Please call or email us.";
const ORDER_FIELDS = ['kind', 'adults', 'children', 'recipientName', 'message', 'buyerName', 'buyerEmail', 'recipientEmail', 'sendTo', 'sendOn'];
const pounds = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
const MIN_CARD_PAYMENT = 30; // Stripe's smallest card payment in pence

const pick = (body) => Object.fromEntries(ORDER_FIELDS.map((key) => [key, body[key]]));
const forStripe = (value) => String(value ?? '').slice(0, 500);

// The order travels through Stripe as metadata (kind 'voucher' marks the session as a voucher), with
// the expiry date the buyer was shown, so the voucher says exactly that
const toMetadata = (order, expiresOn) => ({
    kind: 'voucher',
    voucherKind: order.kind,
    ...Object.fromEntries(ORDER_FIELDS.filter((key) => key !== 'kind').map((key) => [key, forStripe(order[key])])),
    expiresOn,
});
const isVoucherSession = (session) => Boolean(session) && session.mode === 'payment' && session.metadata?.kind === 'voucher';

// Public: checks the order, then sends the buyer to Stripe to pay
const startVoucherCheckout = async (req, res) => {
    if (settings.stripe.problem) {
        console.error('Voucher sale refused:', settings.stripe.problem);
        return res.status(503).json({ ok: false, data: UNAVAILABLE });
    }
    const order = pick(req.body);
    const problem = voucherProblem(order);
    if (problem) return res.status(400).json({ ok: false, data: problem });

    const prices = await readPrices();
    const fields = fromOrder(order);
    const amount = voucherPrice(fields, prices);
    if (amount === null || amount < MIN_CARD_PAYMENT) {
        console.error('Voucher sale refused: the prices have not been set on the dashboard');
        return res.status(503).json({ ok: false, data: UNAVAILABLE });
    }
    const expiresOn = await expiryForToday();
    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            currency: 'gbp',
            customer_email: fields.buyerEmail,
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: 'gbp',
                    unit_amount: amount,
                    product_data: { name: `Gift voucher: ${coversText(fields)}`, description: `Valid until ${validUntil({ expiresOn })}` },
                },
            }],
            success_url: `${settings.publicUrl}/gift-vouchers/thanks?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${settings.publicUrl}/gift-vouchers`,
            metadata: toMetadata(order, expiresOn),
            ...(settings.termsConsent && { consent_collection: { terms_of_service: 'required' } }),
            payment_intent_data: { description: `Sark Boat Trips gift voucher: ${coversShort(fields)}` },
            custom_text: {
                submit: { message: `You pay ${pounds(amount)} now. The voucher is valid until ${validUntil({ expiresOn })}. It can be passed on to someone else, but it can't be refunded.` },
            },
        });
        res.json({ ok: true, url: session.url });
    } catch (error) {
        console.error('Error creating voucher checkout session:', error);
        res.status(502).json({ ok: false, data: "We couldn't open the payment page. Nothing has been charged. Please try again, or contact us." });
    }
};

// Sends a new voucher (now, or leaves it for its day), the buyer's receipt when it goes to someone
// else, and the owner's email. Returns true if every email that was due went out.
const sendNewVoucher = async (voucher, { tellOwner }) => {
    let ok = true;
    if (isDue(voucher)) ok = await deliverVoucher(voucher);
    const now = await Vouchers.findById(voucher._id);
    if (now.buyerEmail && now.deliverTo !== now.buyerEmail) {
        ok = (await trySend(emails.voucherBoughtEmail(now, await voucherPdf(now)))) && ok;
    }
    if (tellOwner) await trySend(emails.voucherSoldOwnerEmail(now, { emailFailed: !ok }));
    return ok;
};

// Everything that follows a paid voucher. The webhook and the thank-you page can both arrive, in any
// order, so the voucher is keyed on the Stripe session and only the call that makes it sends emails.
const fulfillVoucherSession = async (session) => {
    const existing = await Vouchers.findOne({ stripeSessionId: session.id });
    if (existing) return { voucher: existing, created: false };
    if (session.payment_status !== 'paid') return { voucher: null, created: false };

    const md = session.metadata;
    let voucher;
    try {
        voucher = await createVoucher({
            ...fromOrder({ ...md, kind: md.voucherKind }),
            expiresOn: isDay(md.expiresOn) ? md.expiresOn : await expiryForToday(),
            paidBy: 'online',
            amountPaid: Number(session.amount_total) || 0,
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
        });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.stripeSessionId) {
            return { voucher: await Vouchers.findOne({ stripeSessionId: session.id }), created: false };
        }
        throw error;
    }
    await sendNewVoucher(voucher, { tellOwner: true });
    return { voucher, created: true };
};

// The thank-you page asks this once the buyer is back from Stripe
const verifyVoucher = async (req, res) => {
    if (settings.stripe.problem) return res.status(503).json({ ok: false, message: UNAVAILABLE });
    const { session_id } = req.query;
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
        return res.status(400).json({ ok: false, message: 'Missing or invalid payment' });
    }
    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (error) {
        if (error.type === 'StripeInvalidRequestError') return res.status(404).json({ ok: false, message: 'Voucher not found' });
        throw error;
    }
    if (!isVoucherSession(session)) return res.status(404).json({ ok: false, message: 'Voucher not found' });
    const { voucher } = await fulfillVoucherSession(session);
    if (!voucher) return res.json({ ok: false, message: "Your payment didn't go through, so no voucher was made. Nothing has been charged." });
    res.json({
        ok: true,
        code: voucher.code,
        covers: coversText(voucher),
        recipientName: voucher.recipientName,
        expiresOn: voucher.expiresOn,
        deliverTo: voucher.deliverTo,
        sendOn: voucher.sentAt ? null : voucher.sendOn || null,
        buyerEmail: voucher.buyerEmail,
    });
};

// ---------------------------------------------------------------- dashboard

const forDashboard = (voucher) => ({ ...voucher.toObject(), covers: coversText(voucher), expired: voucher.status === 'unused' && isExpired(voucher) });
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const notFound = (res) => res.status(404).send({ ok: false, data: 'Voucher not found.' });
const findVoucher = async (id) => (mongoose.isValidObjectId(id) ? Vouchers.findById(id) : null);

// Every voucher, newest first. q: a code, or part of a name or email.
const list = async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    let filter = {};
    if (q) {
        const pattern = new RegExp(escapeRegex(q), 'i');
        filter = { $or: [{ code: tidyCode(q) || pattern }, { recipientName: pattern }, { buyerName: pattern }, { buyerEmail: pattern }, { recipientEmail: pattern }, { bookingReference: pattern }] };
    }
    const vouchers = await Vouchers.find(filter).sort({ createdAt: -1 }).limit(500);
    res.send({ ok: true, vouchers: vouchers.map(forDashboard) });
};

// The owner makes a voucher: paid by bank transfer or cash, or free (a prize). Nothing is required but
// what it covers. sendTo: 'buyer', 'recipient' or 'none' (they'll print it from the dashboard).
const add = async (req, res) => {
    const order = pick(req.body);
    const problem = voucherProblem(order, { owner: true });
    if (problem) return res.status(400).send({ ok: false, data: problem });
    if (!['bank', 'cash', 'free'].includes(req.body.paidBy)) return res.status(400).send({ ok: false, data: 'Please say how it was paid.' });
    if (order.sendTo === 'buyer' && !String(order.buyerEmail ?? '').trim()) return res.status(400).send({ ok: false, data: "Please enter the buyer's email address, or choose not to email it." });
    const expiresOn = String(req.body.expiresOn ?? '').trim() || await expiryForToday();
    if (!isDay(expiresOn)) return res.status(400).send({ ok: false, data: 'Please enter a valid expiry date.' });

    const fields = fromOrder(order);
    if (order.sendTo === 'none') { fields.deliverTo = undefined; fields.sendOn = undefined; }
    let amountPaid = 0;
    if (req.body.paidBy !== 'free') {
        const typed = String(req.body.amountPaid ?? '').trim();
        amountPaid = typed ? toPence(typed) : voucherPrice(fields, await readPrices());
        if (amountPaid === null) return res.status(400).send({ ok: false, data: typed ? 'Please enter the amount paid in pounds, for example 80.' : 'Enter the amount paid, or set your prices first.' });
    }

    const voucher = await createVoucher({ ...fields, expiresOn, paidBy: req.body.paidBy, amountPaid });
    const emailed = fields.deliverTo ? await sendNewVoucher(voucher, { tellOwner: false }) : true;
    const when = !fields.deliverTo ? '' : isDue(voucher) ? `, emailed to ${fields.deliverTo}` : `, to be emailed to ${fields.deliverTo} on ${showDay(fields.sendOn)}`;
    res.send({
        ok: true,
        data: `Voucher ${voucher.code} made (${coversShort(voucher)})${when}.${emailed ? '' : ' THE EMAIL FAILED: press Resend, or download the PDF.'}`,
        voucher: forDashboard(await Vouchers.findById(voucher._id)),
    });
};

// Marks a voucher used, for a booking (its reference, SBT-...) or on its own. With a booking, the
// voucher's value is taken off what the booking still owes, and a booking it pays for in full is
// marked paid with a voucher, so its saved card isn't charged.
const use = async (req, res) => {
    const voucher = await findVoucher(req.body._id);
    if (!voucher) return notFound(res);
    if (voucher.status === 'used') return res.status(409).send({ ok: false, data: 'This voucher has already been used.' });
    if (isExpired(voucher)) return res.status(409).send({ ok: false, data: `This voucher expired on ${showDay(voucher.expiresOn)}. Press Extend first if you want to accept it.` });

    const reference = String(req.body.reference ?? '').trim().toUpperCase();
    let booking = null, cover = null, full = null;
    if (reference) {
        booking = await Bookings.findOne({ reference: reference.startsWith('SBT-') ? reference : `SBT-${reference}` });
        if (!booking) return res.status(404).send({ ok: false, data: `No booking has the reference ${reference}.` });
        if (booking.status === 'cancelled') return res.status(409).send({ ok: false, data: 'That booking is cancelled.' });
        if (booking.voucher?.code) return res.status(409).send({ ok: false, data: `That booking already has a voucher (${booking.voucher.code}).` });
        if (!['unpaid', 'card_saved', undefined, null].includes(booking.paymentStatus)) return res.status(409).send({ ok: false, data: 'That booking is already paid.' });
        const prices = hasPrices(booking.prices) ? booking.prices : await readPrices();
        cover = coverFor(voucher, booking, prices);
        if (cover.problem) return res.status(400).send({ ok: false, data: cover.problem });
        full = fullValue(booking, prices);
    }

    // Each step only works from the state it expects, so two taps (or the card charge) can't collide
    const claimed = await Vouchers.findOneAndUpdate(
        { _id: voucher._id, status: 'unused' },
        { $set: { status: 'used', usedAt: new Date(), ...(booking && { bookingId: booking._id, bookingReference: booking.reference }) } },
        { new: true },
    );
    if (!claimed) return res.status(409).send({ ok: false, data: 'This voucher has already been used.' });
    if (!booking) return res.send({ ok: true, data: `Voucher ${voucher.code} marked as used.`, voucher: forDashboard(claimed) });

    const value = Math.min(cover.value, full);
    const paysAll = value >= full;
    const updated = await Bookings.findOneAndUpdate(
        { _id: booking._id, status: { $ne: 'cancelled' }, paymentStatus: { $in: ['unpaid', 'card_saved', null] }, 'voucher.code': { $exists: false } },
        { $set: { voucher: { code: voucher.code, value, previousStatus: booking.paymentStatus || 'unpaid' }, ...(paysAll && { paymentStatus: 'voucher' }) } },
        { new: true },
    );
    if (!updated) {
        await Vouchers.updateOne({ _id: voucher._id }, { $set: { status: 'unused' }, $unset: { usedAt: '', bookingId: '', bookingReference: '' } });
        return res.status(409).send({ ok: false, data: 'That booking changed (it may be being charged right now). Please try again.' });
    }
    const name = [updated.firstName, updated.lastName].filter(Boolean).join(' ') || 'the booking';
    const rest = paysAll ? 'Nothing more to pay.' : `${pounds(full - value)} still to pay${updated.paymentStatus === 'card_saved' ? ', charged to their saved card at the trip time' : ''}.`;
    res.send({ ok: true, data: `Voucher ${voucher.code} used for ${name} on ${showDay(updated.date)}: it covers ${pounds(value)}. ${rest}`, voucher: forDashboard(await Vouchers.findById(voucher._id)) });
};

// Undoes "used" (a mistake, or the booking was cancelled), so the voucher can be used again. A booking
// it paid for goes back to how it was (a saved card is charged at the trip time again).
const undo = async (req, res) => {
    const voucher = await findVoucher(req.body._id);
    if (!voucher) return notFound(res);
    const freed = await Vouchers.findOneAndUpdate(
        { _id: voucher._id, status: 'used' },
        { $set: { status: 'unused' }, $unset: { usedAt: '', bookingId: '', bookingReference: '' } },
        { new: true },
    );
    if (!freed) return res.status(409).send({ ok: false, data: 'This voucher is not used.' });
    let note = '';
    if (voucher.bookingId) {
        const booking = await Bookings.findOne({ _id: voucher.bookingId, 'voucher.code': voucher.code });
        if (booking) {
            const back = booking.paymentStatus === 'voucher' ? booking.voucher.previousStatus || 'unpaid' : booking.paymentStatus;
            await Bookings.updateOne({ _id: booking._id, 'voucher.code': voucher.code }, { $set: { paymentStatus: back }, $unset: { voucher: '' } });
            note = booking.status === 'cancelled' ? '' : back === 'card_saved' ? " The booking will be charged to the customer's saved card at the trip time." : ' The booking now has the full amount to pay.';
        }
    }
    res.send({ ok: true, data: `Voucher ${voucher.code} can be used again.${note}`, voucher: forDashboard(freed) });
};

// Emails the voucher again, to its address or a corrected one
const resend = async (req, res) => {
    const voucher = await findVoucher(req.body._id);
    if (!voucher) return notFound(res);
    const to = String(req.body.to ?? '').trim() || voucher.deliverTo || voucher.recipientEmail || voucher.buyerEmail;
    if (!to || voucherProblem({ kind: 'charter', buyerEmail: to }, { owner: true })) return res.status(400).send({ ok: false, data: 'Please enter a valid email address to send it to.' });
    const updated = await Vouchers.findByIdAndUpdate(voucher._id, { $set: { deliverTo: to } }, { new: true });
    if (!(await trySend(emails.voucherEmail(updated, await voucherPdf(updated))))) {
        return res.status(502).send({ ok: false, data: `The email to ${to} could not be sent. Please try again later, or download the PDF.` });
    }
    const sent = await Vouchers.findByIdAndUpdate(voucher._id, { $set: { sentAt: new Date() } }, { new: true });
    res.send({ ok: true, data: `Voucher ${voucher.code} emailed to ${to}.`, voucher: forDashboard(sent) });
};

// A new last day (for bad weather, say, or a favour)
const extend = async (req, res) => {
    const voucher = await findVoucher(req.body._id);
    if (!voucher) return notFound(res);
    if (!isDay(req.body.expiresOn)) return res.status(400).send({ ok: false, data: 'Please choose a valid date.' });
    const updated = await Vouchers.findByIdAndUpdate(voucher._id, { $set: { expiresOn: req.body.expiresOn } }, { new: true });
    res.send({ ok: true, data: `Voucher ${voucher.code} is now valid until ${showDay(updated.expiresOn)}.`, voucher: forDashboard(updated) });
};

// The PDF, to print or hand over (vouchers paid by bank transfer or cash, or a lost email)
const pdf = async (req, res) => {
    const voucher = await findVoucher(req.params.id);
    if (!voucher) return notFound(res);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="sark-boat-trips-gift-voucher-${voucher.code}.pdf"` });
    res.send(await voucherPdf(voucher));
};

module.exports = { startVoucherCheckout, fulfillVoucherSession, isVoucherSession, verifyVoucher, list, add, use, undo, resend, extend, pdf };
