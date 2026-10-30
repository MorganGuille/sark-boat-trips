import { useState } from 'react'
import { authAxios } from '../../services.jsx/auth.jsx'
import { URL } from '../../../config.js'
import { prettyDate } from '../../utils/dates.js'

const TIMESLOTS = ['11am', '2pm']
const seats = (b) => (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0)

// For a weather day: cancels every booking on one trip, emails everyone, charges nobody, and closes
// the trip to new bookings. bookings: the day's bookings as shown on the Bookings tab.
function CancelTripForm({ selectedDate, bookings, onResult, onDone }) {

    const [timeslot, setTimeslot] = useState('11am')
    const [reason, setReason] = useState('weather')
    const [busy, setBusy] = useState(false)

    const activeOn = (slot) => bookings.filter((b) => b.status !== 'cancelled' && b.timeslot === slot)
    const active = activeOn(timeslot)
    const people = active.reduce((sum, b) => sum + seats(b), 0)

    const submit = async () => {
        const who = active.length
            ? `${active.length} booking${active.length === 1 ? '' : 's'} (${people} ${people === 1 ? 'person' : 'people'}) will be cancelled and emailed. Nobody's card will be charged.`
            : 'There are no bookings on it.'
        if (!window.confirm(`Cancel the ${timeslot} trip on ${prettyDate(selectedDate)}?\n\n${who}\nThe trip will be closed to new bookings (you can reopen it from the Availability tab).`)) return
        setBusy(true)
        try {
            const res = await authAxios.post(`${URL}/bookings/cancel-trip`, { date: selectedDate, timeslot, reason })
            onResult(res.data.data, res.data.ok === false ? 'error' : 'success')
            onDone()
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'Could not cancel the trip. Nothing was changed, try again.', 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        // Not a <form>: bookingForm.css styles every form on the site (form div, form select, form button)
        <section className='cancelTrip' aria-labelledby='cancelTripTitle'>
            <h3 id='cancelTripTitle'>Cancel a whole trip</h3>
            <p className='muted'>
                For a weather day: cancels every booking on the trip, emails everyone, charges nobody, and closes the trip
                to new bookings.
            </p>
            <div className='cancelTripRow'>
                <label className='sr-only' htmlFor='cancelTripTime'>Trip</label>
                <select id='cancelTripTime' value={timeslot} onChange={(e) => setTimeslot(e.target.value)}>
                    {TIMESLOTS.map((slot) => {
                        const count = activeOn(slot).length
                        return <option key={slot} value={slot}>{slot} trip ({count} booking{count === 1 ? '' : 's'})</option>
                    })}
                </select>
                <label className='sr-only' htmlFor='cancelTripReason'>Reason</label>
                <select id='cancelTripReason' value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value='weather'>Weather or sea conditions</option>
                    <option value='other'>Other reason</option>
                </select>
                <button className='btn btnSmall btnDanger' type='button' onClick={submit} disabled={busy}>
                    {busy ? 'Cancelling…' : `Cancel ${timeslot} trip`}
                </button>
            </div>
        </section>
    )
}

export default CancelTripForm
