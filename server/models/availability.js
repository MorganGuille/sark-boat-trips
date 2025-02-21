const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
    },
    timeslot: {
        type: String,
        required: true,
    },
    capacity: {
        type: Number,
        required: true,
        min: 0,
    },
});

module.exports = mongoose.model('Availability', availabilitySchema);