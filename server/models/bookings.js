const mongoose = require("mongoose");

const bookingsSchema = new mongoose.Schema({
    // A day as 'YYYY-MM-DD' (see utils/dates.js)
    date: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/,
    },
    timeslot: {
        type: String,
        required: true,
    },
    firstName: {
        type: String,
        required: true,
        unique: false,
    },
    lastName: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true
    },
    adults: {
        type: Number,
        required: true,
    },
    children: {
        type: Number,
    },
    // 3 and under: free, but they take a seat (see utils/party.js)
    infants: {
        type: Number,
    },
    accommodation: {
        type: String,
    },
    message: {
        type: String,
    },
    charter: {
        type: String
    },
    // Bookings without a status (created before cancelling existed) count as active
    status: {
        type: String,
        enum: ['active', 'cancelled'],
        default: 'active',
    },
    cancelledAt: {
        type: Date,
    },
    // The prices (in pence) in force when the booking was made, so later price changes don't alter it
    prices: {
        adult: { type: Number, min: 0 },
        child: { type: Number, min: 0 },
        charter: { type: Number, min: 0 },
    },
    // Payment (see paymentsspec.md). unpaid: nothing taken yet (dashboard bookings, or a failed charge);
    // card_saved: will be charged at the trip time; charging: a charge is under way; paid: charged
    // online; paid_in_person: the owner took cash or card on the day. A booking without one is unpaid.
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'card_saved', 'charging', 'paid', 'paid_in_person'],
        default: 'unpaid',
    },
    paidAt: { type: Date },
    amountPaid: { type: Number, min: 0 }, // pence
    paymentNote: { type: String }, // plain-words reason a charge failed
    stripeCustomerId: { type: String },
    stripePaymentMethodId: { type: String },
    cardLabel: { type: String }, // e.g. "Visa •••• 4242 (expires 08/28)", for the dashboard
    // Set on paid charters. The unique index means one Stripe payment can only ever create one booking
    stripeSessionId: {
        type: String,
        unique: true,
        sparse: true,
    }
});

module.exports = mongoose.model("bookings", bookingsSchema);