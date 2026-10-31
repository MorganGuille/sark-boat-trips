import { useState } from 'react'
import { addTrip, removeTrip } from '../../services.jsx/trips.jsx'
import { prettyDate } from '../../utils/dates.js'
import { formatPounds } from '../../utils/money.js'

// Adds an extra trip to this day (a swim trip, a sunset trip) with its own name, time, harbour, seats,
// length and prices. Customers can book it online straight away, by the seat. Also lists the day's extra
// trips, each with a Delete button (refused while anyone is booked on it).
// trips: the day's trips; bookings: the day's bookings (null if not loaded); prices: the normal prices in
// pounds (to start from). Shown on the dashboard's Extra trips tab.
function AddTripForm({ selectedDate, trips, bookings, prices, onResult, onDone }) {

    const [name, setName] = useState('')
    const [startTime, setStartTime] = useState('17:00')
    const [hours, setHours] = useState('2')
    const [capacity, setCapacity] = useState('12')
    const [adultPrice, setAdultPrice] = useState(prices?.adult != null ? String(prices.adult) : '')
    const [childPrice, setChildPrice] = useState(prices?.child != null ? String(prices.child) : '')
    const [harbour, setHarbour] = useState('creux')
    const [note, setNote] = useState('')
    const [busy, setBusy] = useState(false)

    const extras = trips.filter((trip) => trip.extra)
    const bookedOn = (trip) => bookings?.filter((b) => b.status !== 'cancelled' && b.timeslot === trip.timeslot).length

    const run = async (action, failure) => {
        setBusy(true)
        try {
            const res = await action()
            onResult(res.data, res.ok === false ? 'error' : 'success')
            if (res.ok !== false) onDone()
            return res.ok !== false
        } catch (error) {
            if (error.response?.status === 401) return false
            onResult(error.response?.data?.data || failure, 'error')
            return false
        } finally {
            setBusy(false)
        }
    }

    const submit = async () => {
        if (!window.confirm(`Add "${name.trim()}" on ${prettyDate(selectedDate)} at ${startTime}, ${capacity} seats, £${adultPrice} adults and £${childPrice} children?\n\nCustomers can book it online straight away.`)) return
        const added = await run(
            () => addTrip({ date: selectedDate, name, note, startTime, harbour, hours, capacity, adultPrice, childPrice }),
            'Could not add the trip. Nothing was added, try again.'
        )
        if (added) {
            setName('')
            setNote('')
        }
    }

    const remove = (trip) => {
        if (!window.confirm(`Delete the ${trip.label} on ${prettyDate(selectedDate)}?\n\nCustomers will no longer see it.`)) return
        run(() => removeTrip({ date: selectedDate, timeslot: trip.timeslot }), 'Could not delete the trip. Try again.')
    }

    return (
        // Not a <form>: bookingForm.css styles every form on the site (form div, form select, form button)
        <section className='addTrip' aria-labelledby='addTripTitle'>
            <h2 id='addTripTitle'>Extra trips on {prettyDate(selectedDate)}</h2>
            <p className='muted'>
                Add a one-off trip to this day, such as a swim trip or a sunset trip, with its own seats, length and prices.
                It shows on the calendar and customers can book it online straight away (by the seat, not as a charter).
                To add a trip to another day, pick it on the calendar.
            </p>
            {extras.length ? (
                <ul className='extraTrips'>
                    {extras.map((trip) => {
                        const count = bookedOn(trip)
                        return (
                            <li key={trip.timeslot}>
                                <span>
                                    <strong>{trip.label}</strong>{trip.harbourChanged ? `, ${trip.harbour}` : ''}: {trip.hours} hours,{' '}
                                    {formatPounds(Number(trip.prices.adult))} adults, {formatPounds(Number(trip.prices.child))} children
                                    {count === undefined ? '' : `, ${count} booking${count === 1 ? '' : 's'}`}
                                </span>
                                <button type='button' className='btn btnSmall btnGhost' onClick={() => remove(trip)} disabled={busy}
                                    aria-label={`Delete ${trip.label}`}>
                                    Delete
                                </button>
                            </li>
                        )
                    })}
                </ul>
            ) : <p className='emptyState'>No extra trips on this day.</p>}
            <h3>Add a trip</h3>
            <div className='changeTripRow'>
                <label>
                    Name
                    <input type='text' value={name} maxLength='40' placeholder='e.g. Swim trip' onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                    Time
                    <input type='time' value={startTime} min='07:00' max='20:00' step='300' onChange={(e) => setStartTime(e.target.value)} />
                </label>
                <label>
                    Length (hours)
                    <input type='number' value={hours} min='0.5' max='8' step='0.25' onChange={(e) => setHours(e.target.value)} />
                </label>
                <label>
                    Seats
                    <input type='number' value={capacity} min='1' max='100' onChange={(e) => setCapacity(e.target.value)} />
                </label>
                <label>
                    Adult price (£)
                    <input type='number' value={adultPrice} min='0' step='0.01' onChange={(e) => setAdultPrice(e.target.value)} />
                </label>
                <label>
                    Child price (£)
                    <input type='number' value={childPrice} min='0' step='0.01' onChange={(e) => setChildPrice(e.target.value)} />
                </label>
                <label>
                    Leaves from
                    <select value={harbour} onChange={(e) => setHarbour(e.target.value)}>
                        <option value='creux'>Creux Harbour</option>
                        <option value='maseline'>Maseline Harbour</option>
                    </select>
                </label>
            </div>
            <label className='changeTripNote'>
                Note to customers (optional)
                <textarea rows='2' maxLength='300' value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder='e.g. Bring swimwear and a towel. We stop in a sheltered bay for a swim.' />
            </label>
            <div>
                <button className='btn btnSmall' type='button' onClick={submit}
                    disabled={busy || !name.trim() || !startTime || !hours || !capacity || adultPrice === '' || childPrice === ''}>
                    {busy ? 'Saving…' : 'Add extra trip'}
                </button>
            </div>
        </section>
    )
}

export default AddTripForm
