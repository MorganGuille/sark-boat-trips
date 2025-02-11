const mongoose = require("mongoose");

const bookingsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    phone: {
        type: Number,
        requaired: true,
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

    }
});

module.exports = mongoose.model("bookings", bookingsSchema);