const mongoose = require("mongoose");

const bookingsSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
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
    }
});

module.exports = mongoose.model("bookings", bookingsSchema);