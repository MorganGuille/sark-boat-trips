import { useState } from 'react'
import { changeTrip, tripName } from '../../services.jsx/trips.jsx'
import { prettyDate } from '../../utils/dates.js'

const HARBOURS = [
    { key: 'creux', name: 'Creux Harbour' },
    { key: 'maseline', name: 'Maseline Harbour' },
]

// Moves one trip to another time and/or harbour for this day (low tide, weather). Everyone booked on it
// is emailed the new details with the owner's note, unless the owner has already told them.
// trips: the day's trips as they are now (from the dashboard, which gives this a new key when they
// change, so it starts again from them); bookings: the day's bookings.
function ChangeTripForm({ selectedDate, trips, bookings, onResult, onDone }) {

    const [timeslot, setTimeslot] = useState('11am')
    const trip = trips.find((t) => t.timeslot === timeslot) || trips[0]
    const [startTime, setStartTime] = useState(trip?.startTime || '11:00')
    const [harbour, setHarbour] = useState(trip?.harbourKey || 'creux')
    const [note, setNote] = useState('')
    const [notify, setNotify] = useState(true)
    const [busy, setBusy] = useState(false)

    // Choosing a trip starts from its time and harbour as they are now
    const chooseTrip = (slot) => {
        const chosen = trips.find((t) => t.timeslot === slot)
        setTimeslot(slot)
        setStartTime(chosen.startTime)
        setHarbour(chosen.harbourKey)
    }

    if (!trip) return null
    const active = bookings.filter((b) => b.status !== 'cancelled' && b.timeslot === trip.timeslot)
    const unchanged = startTime === trip.startTime && harbour === trip.harbourKey
    const harbourName = HARBOURS.find((h) => h.key === harbour)?.name

    const submit = async () => {
        const told = !active.length
            ? 'There are no bookings on it.'
            : notify
                ? `${active.length} booking${active.length === 1 ? '' : 's'} will be emailed the new details.`
                : `${active.length} booking${active.length === 1 ? '' : 's'} will NOT be emailed (you've told them yourself).`
        if (!window.confirm(`Move the ${tripName(trip)} on ${prettyDate(selectedDate)} to ${startTime} from the ${harbourName}?\n\n${told}`)) return
        setBusy(true)
        try {
            const res = await changeTrip({ date: selectedDate, timeslot: trip.timeslot, startTime, harbour, note, notifyCustomers: notify })
            onResult(res.data, res.ok === false ? 'error' : 'success')
            if (res.ok !== false) {
                setNote('')
                onDone()
            }
        } catch (error) {
            if (error.response?.status === 401) return
            onResult(error.response?.data?.data || 'Could not change the trip. Nothing was changed, try again.', 'error')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className='changeTrip' aria-labelledby='changeTripTitle'>
            <h3 id='changeTripTitle'>Change trip details</h3>
            <p className='muted'>
                Move a trip to another time or harbour for this day only. Everyone booked on it gets an email with the new
                details, your note and an updated calendar entry, and their card is charged at the new time.
            </p>
            <div className='changeTripRow'>
                <label>
                    Trip
                    <select value={trip.timeslot} onChange={(e) => chooseTrip(e.target.value)}>
                        {trips.map((t) => {
                            const count = bookings.filter((b) => b.status !== 'cancelled' && b.timeslot === t.timeslot).length
                            return <option key={t.timeslot} value={t.timeslot}>{t.extra ? t.label : `${t.time}${t.timeChanged ? ` (usually ${t.timeslot})` : ''} trip`} ({count} booking{count === 1 ? '' : 's'})</option>
                        })}
                    </select>
                </label>
                <label>
                    New time
                    <input type='time' value={startTime} min='07:00' max='20:00' step='300' onChange={(e) => setStartTime(e.target.value)} />
                </label>
                <label>
                    Leaves from
                    <select value={harbour} onChange={(e) => setHarbour(e.target.value)}>
                        {HARBOURS.map((h) => <option key={h.key} value={h.key}>{h.name}</option>)}
                    </select>
                </label>
            </div>
            <label className='changeTripNote'>
                Note to customers (optional)
                <textarea rows='2' maxLength='500' value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder='e.g. Because of the tide we are leaving from the Maseline Harbour. Thank you for being flexible!' />
            </label>
            <label className='toggle'>
                <input type='checkbox' checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Email the customers on this trip
            </label>
            <div>
                <button className='btn btnSmall' type='button' onClick={submit} disabled={busy || unchanged || !startTime}>
                    {busy ? 'Saving…' : 'Save change'}
                </button>
            </div>
        </section>
    )
}

export default ChangeTripForm
