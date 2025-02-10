const mongoose = require("mongoose");

const bookingsSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        unique: true
    },
    lastName: {
        type: String,
        required: true,
        unique: true
    },
    adults: {
        type: Number,
        required: true,
    },
    children: {
        type: Number,

    }
});

module.exports = mongoose.model("category", categorySchema);