import { useState } from 'react'
import { authAxios } from '../../services.jsx/auth.jsx'
import { URL } from '../../../config.js'
import { prettyDate } from '../../utils/dates.js'

// trips: the day's trips (the usual two and any extra ones)
function AvailabilityForm({ selectedDate, trips, onResult, onDone }) {

    const [timeslot, setTimeslot] = useState('11am')
    const [capacity, setCapacity] = useState('12')
    const [busy, setBusy] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
            const res = await authAxios.post(`${URL}/bookings/updateavailability`, { date: selectedDate, timeslot, capacity })
            onResult(res.data.data)
            onDone()
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'Could not update availability', 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        <form className='panelForm' onSubmit={submit}>
            <h2>Availability for {prettyDate(selectedDate)}</h2>
            <p className='muted'>
                Set the total number of seats for one trip. Seats that are already booked are taken off this number.
                To change another day, pick it on the calendar.
            </p>
            <div className='fieldRow'>
                <label htmlFor='availTimeslot'>Trip</label>
                <select id='availTimeslot' value={timeslot} onChange={(e) => setTimeslot(e.target.value)}>
                    {trips.map((trip) => <option key={trip.timeslot} value={trip.timeslot}>{trip.label}</option>)}
                </select>
            </div>
            <div className='fieldRow'>
                <label htmlFor='availCapacity'>Capacity (seats)</label>
                <input id='availCapacity' type='number' min='0' value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
            </div>
            <button className='btn' type='submit' disabled={busy}>{busy ? 'Saving…' : 'Update availability'}</button>
        </form>
    )
}

export default AvailabilityForm
