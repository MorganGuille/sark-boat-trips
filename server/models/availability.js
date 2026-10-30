const mongoose = require('mongoose');

// One trip on one day, only when it differs from the usual (seats, time or harbour)
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
    // Seats on the trip that day (missing: the usual 12, see utils/availability.js)
    capacity: {
        type: Number,
        min: 0,
    },
    // The owner moved the trip for this day (utils/trips.js): its start time ('15:00') and the harbour
    // it leaves from ('maseline'). Missing: the usual time, from the Creux Harbour.
    startTime: { type: String },
    harbour: { type: String },
});

module.exports = mongoose.model('Availability', availabilitySchema);