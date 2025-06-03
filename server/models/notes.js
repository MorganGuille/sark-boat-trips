const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true
    }
})

module.exports = mongoose.model('Notes', NoteSchema)