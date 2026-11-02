const mongoose = require('mongoose');

// A gift voucher (owner's decisions, 2 Nov 2026): for people on a trip (adults and children at the
// normal prices) or a private charter, valid until the end of next season, not refundable but can be
// passed on. Bought online (controllers/vouchers.js) or made by the owner on the dashboard. Whether
// it has expired is worked out from expiresOn, never stored. See utils/vouchers.js.
const vouchersSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // GIFT-7KQ4-M2, quoted when booking
    kind: { type: String, enum: ['trip', 'charter'], required: true },
    adults: { type: Number, min: 0, default: 0 },
    children: { type: Number, min: 0, default: 0 },
    recipientName: { type: String }, // who it's for
    message: { type: String }, // the buyer's message, printed on the voucher
    buyerName: { type: String },
    buyerEmail: { type: String },
    recipientEmail: { type: String },
    // The voucher email goes to deliverTo on sendOn ('YYYY-MM-DD', Guernsey time) or straight away
    deliverTo: { type: String },
    erasedAt: { type: Date }, // a buyer's or recipient's details were erased at their request (utils/customerData.js)
    sendOn: { type: String },
    sentAt: { type: Date },
    sendAttempts: { type: Number },
    expiresOn: { type: String, required: true }, // 'YYYY-MM-DD', the last day it can be used
    // online: paid by card on Stripe's page; bank, cash or free (a prize): made on the dashboard
    paidBy: { type: String, enum: ['online', 'bank', 'cash', 'free'], required: true },
    amountPaid: { type: Number, min: 0, default: 0 }, // pence
    stripeSessionId: { type: String, unique: true, sparse: true }, // one payment makes one voucher
    stripePaymentIntentId: { type: String },
    status: { type: String, enum: ['unused', 'used'], default: 'unused' },
    usedAt: { type: Date },
    // The booking it paid for (if the owner gave one) and how much of it the voucher covered
    bookingId: { type: mongoose.Schema.Types.ObjectId },
    bookingReference: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('vouchers', vouchersSchema);
