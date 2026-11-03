import { useState } from 'react'
import { authAxios } from '../../services.jsx/auth.jsx'
import { URL } from '../../../config.js'
import { prettyDate } from '../../utils/dates.js'
import { tripName } from '../../services.jsx/trips.jsx'
import { useConfirm } from '../../hooks/useConfirm'
const seats = (b) => (Number(b.adults) || 0) + (Number(b.children) || 0) + (Number(b.infants) || 0)

// For a weather day: cancels every booking on one trip, emails everyone, charges nobody, and closes
// the trip to new bookings. trips: the day's trips; bookings: the day's bookings as shown on the Bookings tab.
function CancelTripForm({ selectedDate, trips, bookings, onResult, onDone }) {
    const confirm = useConfirm()

    const [timeslot, setTimeslot] = useState('11am')
    const [reason, setReason] = useState('weather')
    const [busy, setBusy] = useState(false)

    const activeOn = (slot) => bookings.filter((b) => b.status !== 'cancelled' && b.timeslot === slot)
    const active = activeOn(timeslot)
    const trip = trips.find((t) => t.timeslot === timeslot) || trips[0]
    const people = active.reduce((sum, b) => sum + seats(b), 0)

    const submit = async () => {
        const who = active.length
            ? `${active.length} booking${active.length === 1 ? '' : 's'} (${people} ${people === 1 ? 'person' : 'people'}) will be cancelled and emailed. Nobody's card will be charged.`
            : 'There are no bookings on it.'
        if (!(await confirm({
            title: `Cancel the ${tripName(trip)}?`, details: [prettyDate(selectedDate)], danger: true, yes: 'Yes, cancel the trip', no: 'Keep it',
            body: [who, 'The trip will be closed to new bookings (you can reopen it from the Availability tab).'],
        }))) return
        setBusy(true)
        try {
            const res = await authAxios.post(`${URL}/bookings/cancel-trip`, { date: selectedDate, timeslot: trip.timeslot, reason })
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
        <section className='cancelTrip' aria-labelledby='cancelTripTitle'>
            <h3 id='cancelTripTitle'>Cancel a whole trip</h3>
            <p className='muted'>
                For a weather day: cancels every booking on the trip, emails everyone, charges nobody, and closes the trip
                to new bookings.
            </p>
            <div className='cancelTripRow'>
                <label className='sr-only' htmlFor='cancelTripTime'>Trip</label>
                <select id='cancelTripTime' value={trip?.timeslot} onChange={(e) => setTimeslot(e.target.value)}>
                    {trips.map((t) => {
                        const count = activeOn(t.timeslot).length
                        return <option key={t.timeslot} value={t.timeslot}>{tripName(t)} ({count} booking{count === 1 ? '' : 's'})</option>
                    })}
                </select>
                <label className='sr-only' htmlFor='cancelTripReason'>Reason</label>
                <select id='cancelTripReason' value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value='weather'>Weather or sea conditions</option>
                    <option value='other'>Other reason</option>
                </select>
                <button className='btn btnSmall btnDanger' type='button' onClick={submit} disabled={busy}>
                    {busy ? 'Cancelling…' : `Cancel ${tripName(trip)}`}
                </button>
            </div>
        </section>
    )
}

export default CancelTripForm
