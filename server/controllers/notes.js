const Notes = require('../models/notes')

const addOrUpdateNote = async (req, res) => {

    const { date, content } = req.body

    if (!date || !content) {
        return res.status(400).json({ success: false, message: 'Date and Content are required' })
    }

    try {
        let note = await Notes.findOneAndUpdate(
            { date: date },
            { content: content },
            { new: true, upsert: true }
        )
        res.status(201).json({ success: true, message: 'Note added successfully', data: note })

    } catch (error) {
        console.error("Error saving note", error)
        res.status(500).json({ success: false, message: 'Server Error', error: error.message })
    }

}

const getNotesByDate = async (req, res) => {
    const date = req.params.date

    try {
        const notes = await Notes.find({ date: date })
        res.status(200).json({ success: true, count: notes.length, data: notes })
    } catch (error) {
        console.error("Error fetching notes by date", error)
        res.status(500).json({ success: false, message: 'Server error', error: error.message })
    }

}

module.exports = { addOrUpdateNote, getNotesByDate }