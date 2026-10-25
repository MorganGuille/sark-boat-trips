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
    // Set on paid charters. The unique index means one Stripe payment can only ever create one booking
    stripeSessionId: {
        type: String,
        unique: true,
        sparse: true,
    }
});

module.exports = mongoose.model("bookings", bookingsSchema);