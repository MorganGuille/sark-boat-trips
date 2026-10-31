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
    // An extra trip the owner added for this day (a swim trip, a sunset trip: utils/trips.js). Its
    // timeslot is a made-up name ('x3fa9c1') that its bookings store; startTime, harbour and capacity
    // are always set. removed: deleted after its bookings were cancelled (kept so they still read right).
    extra: { type: Boolean },
    name: { type: String },
    note: { type: String },
    hours: { type: Number },
    prices: { adult: { type: Number }, child: { type: Number } }, // pence
    removed: { type: Boolean },
});

module.exports = mongoose.model('Availability', availabilitySchema);