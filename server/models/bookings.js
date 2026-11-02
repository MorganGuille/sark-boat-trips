const mongoose = require("mongoose");
const { newManageToken, newReference } = require("../utils/bookingCodes");

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
    // online; paid_in_person: the owner took cash or card on the day; voucher: a gift voucher covers
    // all of it. A booking without one is unpaid.
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'card_saved', 'charging', 'paid', 'paid_in_person', 'voucher'],
        default: 'unpaid',
    },
    // A gift voucher used for this booking (utils/vouchers.js): its code, what it covers in pence (taken
    // off what is charged or collected, see bookingValue) and the payment status it had before.
    voucher: {
        code: { type: String },
        value: { type: Number, min: 0 },
        previousStatus: { type: String },
    },
    paidAt: { type: Date },
    amountPaid: { type: Number, min: 0 }, // pence
    paymentNote: { type: String }, // plain-words reason a charge failed
    stripeCustomerId: { type: String },
    stripePaymentMethodId: { type: String },
    cardLabel: { type: String }, // e.g. "Visa •••• 4242 (expires 08/28)", for the dashboard
    // The charge at the trip time (utils/charges.js)
    stripePaymentIntentId: { type: String },
    chargeStartedAt: { type: Date },
    chargeAttempts: { type: Number },
    // The reminder email the evening before the trip (utils/reminders.js)
    reminderSentAt: { type: Date },
    reminderAttempts: { type: Number },
    // The customer's "manage my booking" link and the short reference they quote (utils/bookingCodes.js)
    manageToken: { type: String, index: true },
    reference: { type: String, index: true },
    erasedAt: { type: Date }, // the customer's details were erased at their request (utils/customerData.js)
    // Set on paid charters. The unique index means one Stripe payment can only ever create one booking
    stripeSessionId: {
        type: String,
        unique: true,
        sparse: true,
    }
});

// Every new booking gets its codes, however it is made (online, dashboard)
bookingsSchema.pre('save', function () {
    if (this.isNew && !this.manageToken) {
        this.manageToken = newManageToken();
        this.reference = newReference();
    }
});

module.exports = mongoose.model("bookings", bookingsSchema);