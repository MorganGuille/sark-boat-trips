import { useState } from 'react'
import { messageTrip } from '../../services.jsx/trips.jsx'
import { prettyDate } from '../../utils/dates.js'

// Emails the owner's own message to everyone booked on one trip ("bring a jacket, it's choppy").
// trips: the day's trips as they are now (from the dashboard); bookings: the day's bookings.
function MessageTripForm({ selectedDate, trips, bookings, onResult, onDone }) {

    const [timeslot, setTimeslot] = useState('11am')
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)

    const trip = trips.find((t) => t.timeslot === timeslot) || trips[0]
    if (!trip) return null
    const activeOn = (slot) => bookings.filter((b) => b.status !== 'cancelled' && b.timeslot === slot)
    const active = activeOn(timeslot)
    const withEmail = active.filter((b) => b.email).length

    const submit = async () => {
        const missing = active.length - withEmail
        if (!window.confirm(`Send this message to everyone on the ${trip.time} trip on ${prettyDate(selectedDate)}?\n\n${withEmail} customer${withEmail === 1 ? '' : 's'} will be emailed.${missing ? ` ${missing} ha${missing === 1 ? 's' : 've'} no email address.` : ''}`)) return
        setBusy(true)
        try {
            const res = await messageTrip({ date: selectedDate, timeslot, message })
            onResult(res.data, res.ok === false ? 'error' : 'success')
            if (res.ok !== false) {
                setMessage('')
                onDone()
            }
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'Could not send the message. Try again.', 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        // Not a <form>: bookingForm.css styles every form on the site (form div, form select, form button)
        <section className='messageTrip' aria-labelledby='messageTripTitle'>
            <h3 id='messageTripTitle'>Message everyone on a trip</h3>
            <p className='muted'>
                Emails your message to everyone booked on the trip, with their booking details underneath. Nothing about
                the booking changes.
            </p>
            <label>
                Trip
                <select value={timeslot} onChange={(e) => setTimeslot(e.target.value)}>
                    {trips.map((t) => {
                        const count = activeOn(t.timeslot).length
                        return <option key={t.timeslot} value={t.timeslot}>{t.time} trip ({count} booking{count === 1 ? '' : 's'})</option>
                    })}
                </select>
            </label>
            <label>
                Message
                <textarea rows='3' maxLength='1000' value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. It's a bit choppy today, so please bring a warm jacket. See you at the harbour!" />
            </label>
            <div>
                <button className='btn btnSmall' type='button' onClick={submit} disabled={busy || !message.trim() || !active.length}>
                    {busy ? 'Sending…' : active.length ? `Send to ${trip.time} trip` : 'Nobody booked on this trip'}
                </button>
            </div>
        </section>
    )
}

export default MessageTripForm
