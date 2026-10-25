const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
    // A day as 'YYYY-MM-DD' (see utils/dates.js)
    date: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/,
    },
    content: {
        type: String,
        required: true,
        trim: true
    }
})

module.exports = mongoose.model('Notes', NoteSchema)