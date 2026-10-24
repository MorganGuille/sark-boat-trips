const mongoose = require('mongoose')
const Notes = require('../models/notes')

const addNote = async (req, res) => {

    const { date, content } = req.body

    if (!date || !content || !content.trim()) {
        return res.status(400).json({ success: false, message: 'Date and Content are required' })
    }

    try {
        const note = await Notes.create({ date, content })
        res.status(201).json({ success: true, message: 'Note added', data: note })

    } catch (error) {
        console.error("Error saving note", error)
        res.status(500).json({ success: false, message: 'Server Error', error: error.message })
    }

}

const getNotesByDate = async (req, res) => {
    const date = req.params.date

    try {
        const notes = await Notes.find({ date: date }).sort({ _id: 1 })
        res.status(200).json({ success: true, count: notes.length, data: notes })
    } catch (error) {
        console.error("Error fetching notes by date", error)
        res.status(500).json({ success: false, message: 'Server error', error: error.message })
    }

}

const deleteNote = async (req, res) => {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid note id' })
    }

    try {
        const deleted = await Notes.findByIdAndDelete(id)
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Note not found' })
        }
        res.status(200).json({ success: true, message: 'Note deleted' })
    } catch (error) {
        console.error("Error deleting note", error)
        res.status(500).json({ success: false, message: 'Server error', error: error.message })
    }
}

module.exports = { addNote, getNotesByDate, deleteNote }
