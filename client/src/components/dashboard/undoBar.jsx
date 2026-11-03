import { useEffect, useState } from 'react'

// "Booking cancelled · Undo" at the bottom of the screen for 30 seconds after Cancel (spec P3-6).
// The cancellation emails wait about a minute (server/utils/cancelEmails.js), so pressing Undo in
// that time puts the booking back without the customer hearing anything. Only the number changes
// each second; screen readers hear "Booking cancelled" once, not the countdown.
export default function UndoBar({ text, seconds = 30, onUndo, onDone }) {
    const [left, setLeft] = useState(seconds)

    useEffect(() => {
        const timer = setInterval(() => setLeft((n) => n - 1), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (left <= 0) onDone()
    }, [left, onDone])

    return (
        <div className='undoBar'>
            <span role='status'>{text}</span>
            <span className='undoCount' aria-hidden='true'>{left}s</span>
            <button type='button' onClick={onUndo}>Undo</button>
        </div>
    )
}
