import { useRef, useState } from 'react'
import { addTrip, editTrip, removeTrip } from '../../services.jsx/trips.jsx'
import { prettyDate } from '../../utils/dates.js'
import { formatPounds } from '../../utils/money.js'

// Adds an extra trip to this day (a swim trip, a sunset trip) with its own name, time, harbour, seats,
// length and prices. Customers can book it online straight away, by the seat. Also lists the day's extra
// trips, each with Edit (the same form, filled in) and Delete (refused while anyone is booked on it).
// trips: the day's trips; bookings: the day's bookings (null if not loaded); prices: the normal prices in
// pounds (to start from). Shown on the dashboard's Extra trips tab.
function AddTripForm({ selectedDate, trips, bookings, prices, onResult, onDone }) {

    const blank = () => ({
        name: '', startTime: '17:00', hours: '2', capacity: '12', harbour: 'creux', note: '',
        adultPrice: prices?.adult != null ? String(prices.adult) : '',
        childPrice: prices?.child != null ? String(prices.child) : '',
    })
    const [form, setForm] = useState(blank)
    const [editing, setEditing] = useState(null) // the extra trip being edited, or null when adding
    const [notify, setNotify] = useState(true)
    const [busy, setBusy] = useState(false)
    const nameInput = useRef(null)

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
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

    const startEditing = (trip) => {
        setEditing(trip)
        setNotify(true)
        setForm({
            name: trip.name, startTime: trip.startTime, hours: String(trip.hours), capacity: String(trip.capacity),
            harbour: trip.harbourKey, note: trip.note || '', adultPrice: trip.prices.adult, childPrice: trip.prices.child,
        })
        nameInput.current?.focus()
    }

    const stopEditing = () => {
        setEditing(null)
        setForm(blank())
    }

    const add = async () => {
        if (!window.confirm(`Add "${form.name.trim()}" on ${prettyDate(selectedDate)} at ${form.startTime}, ${form.capacity} seats, £${form.adultPrice} adults and £${form.childPrice} children?\n\nCustomers can book it online straight away.`)) return
        const added = await run(() => addTrip({ date: selectedDate, ...form }), 'Could not add the trip. Nothing was added, try again.')
        if (added) setForm({ ...form, name: '', note: '' }) // the time, seats and prices stay, for adding a similar trip
    }

    const save = async () => {
        const count = bookedOn(editing)
        const who = count === undefined ? 'Everyone booked on it' : `${count} booking${count === 1 ? '' : 's'} on it`
        const warnings = []
        if (count !== 0 && (Number(form.adultPrice) !== Number(editing.prices.adult) || Number(form.childPrice) !== Number(editing.prices.child))) {
            warnings.push(`${who} will be charged the new price (£${form.adultPrice} adults, £${form.childPrice} children), unless already paid. You may want to tell them.`)
        }
        if (count !== 0 && (form.startTime !== editing.startTime || form.harbour !== editing.harbourKey)) {
            warnings.push(notify ? `${who} will be emailed the new time and harbour.` : `${who} will NOT be emailed the new time and harbour (you've told them yourself).`)
        }
        if (!window.confirm(`Save the changes to the ${editing.label} on ${prettyDate(selectedDate)}?${warnings.length ? `\n\n${warnings.join('\n\n')}` : ''}`)) return
        const saved = await run(
            () => editTrip({ date: selectedDate, timeslot: editing.timeslot, ...form, notifyCustomers: notify }),
            'Could not save the changes. Nothing was changed, try again.'
        )
        if (saved) stopEditing()
    }

    const remove = (trip) => {
        if (!window.confirm(`Delete the ${trip.label} on ${prettyDate(selectedDate)}?\n\nCustomers will no longer see it.`)) return
        run(() => removeTrip({ date: selectedDate, timeslot: trip.timeslot }), 'Could not delete the trip. Try again.')
        if (editing?.timeslot === trip.timeslot) stopEditing()
    }

    const incomplete = !form.name.trim() || !form.startTime || !form.hours || !form.capacity || form.adultPrice === '' || form.childPrice === ''

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
                            <li key={trip.timeslot} className={editing?.timeslot === trip.timeslot ? 'beingEdited' : undefined}>
                                <span>
                                    <strong>{trip.label}</strong>{trip.harbourChanged ? `, ${trip.harbour}` : ''}: {trip.capacity} seats, {trip.hours} hours,{' '}
                                    {formatPounds(Number(trip.prices.adult))} adults, {formatPounds(Number(trip.prices.child))} children
                                    {count === undefined ? '' : `, ${count} booking${count === 1 ? '' : 's'}`}
                                </span>
                                <span className='extraTripButtons'>
                                    <button type='button' className='btn btnSmall btnGhost' onClick={() => startEditing(trip)} disabled={busy}
                                        aria-label={`Edit ${trip.label}`}>
                                        Edit
                                    </button>
                                    <button type='button' className='btn btnSmall btnGhost' onClick={() => remove(trip)} disabled={busy}
                                        aria-label={`Delete ${trip.label}`}>
                                        Delete
                                    </button>
                                </span>
                            </li>
                        )
                    })}
                </ul>
            ) : <p className='emptyState'>No extra trips on this day.</p>}

            <h3>{editing ? `Edit ${editing.label}` : 'Add a trip'}</h3>
            <div className='changeTripRow'>
                <label>
                    Name
                    <input ref={nameInput} type='text' value={form.name} maxLength='40' placeholder='e.g. Swim trip' onChange={set('name')} />
                </label>
                <label>
                    Time
                    <input type='time' value={form.startTime} min='07:00' max='20:00' step='300' onChange={set('startTime')} />
                </label>
                <label>
                    Length (hours)
                    <input type='number' value={form.hours} min='0.5' max='8' step='0.25' onChange={set('hours')} />
                </label>
                <label>
                    Seats
                    <input type='number' value={form.capacity} min='1' max='12' onChange={set('capacity')} />
                </label>
                <label>
                    Adult price (£)
                    <input type='number' value={form.adultPrice} min='0' step='0.01' onChange={set('adultPrice')} />
                </label>
                <label>
                    Child price (£)
                    <input type='number' value={form.childPrice} min='0' step='0.01' onChange={set('childPrice')} />
                </label>
                <label>
                    Leaves from
                    <select value={form.harbour} onChange={set('harbour')}>
                        <option value='creux'>Creux Harbour</option>
                        <option value='maseline'>Maseline Harbour</option>
                    </select>
                </label>
            </div>
            <label className='changeTripNote'>
                Note to customers (optional)
                <textarea rows='2' maxLength='300' value={form.note} onChange={set('note')}
                    placeholder='e.g. Bring swimwear and a towel. We stop in a sheltered bay for a swim.' />
            </label>
            {editing ? (
                <label className='toggle'>
                    <input type='checkbox' checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                    Email the customers if the time or harbour changes
                </label>
            ) : null}
            <div className='extraTripButtons'>
                {editing ? (<>
                    <button className='btn btnSmall' type='button' onClick={save} disabled={busy || incomplete}>
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                    <button className='btn btnSmall btnGhost' type='button' onClick={stopEditing} disabled={busy}>Stop editing</button>
                </>) : (
                    <button className='btn btnSmall' type='button' onClick={add} disabled={busy || incomplete}>
                        {busy ? 'Saving…' : 'Add extra trip'}
                    </button>
                )}
            </div>
        </section>
    )
}

export default AddTripForm
