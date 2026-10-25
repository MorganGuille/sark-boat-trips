const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
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
    capacity: {
        type: Number,
        required: true,
        min: 0,
    },
});

module.exports = mongoose.model('Availability', availabilitySchema);