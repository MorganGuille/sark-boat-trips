import { useState } from 'react'
import { prettyDate } from '../../utils/dates.js'

function NotesPanel({ selectedDate, notes, onAdd, onDelete }) {

    const [content, setContent] = useState('')
    const [busy, setBusy] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
            if (await onAdd(content.trim())) setContent('')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='notesPanel'>
            <h2>Notes for {prettyDate(selectedDate)}</h2>

            {notes.length ? (
                <ul className='noteList'>
                    {notes.map((note) => (
                        <li key={note._id}>
                            <p>{note.content}</p>
                            <button type='button' className='btn btnSmall btnDanger' onClick={() => onDelete(note)}>Delete</button>
                        </li>
                    ))}
                </ul>
            ) : <p className='emptyState'>No notes for this day yet.</p>}

            <form className='panelForm' onSubmit={submit}>
                <label htmlFor='newNote'>Add a note</label>
                <textarea id='newNote' rows='3' value={content} placeholder='Write a note…'
                    onChange={(e) => setContent(e.target.value)} />
                <button className='btn' type='submit' disabled={busy || !content.trim()}>
                    {busy ? 'Adding…' : 'Add note'}
                </button>
            </form>
        </div>
    )
}

export default NotesPanel
