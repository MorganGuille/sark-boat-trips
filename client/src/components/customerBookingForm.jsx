import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { URL } from '../../config.js'
import { parseDay } from '../utils/dates.js'
import { FREE_CANCEL_HOURS } from '../utils/policy.js'
import { getDayTrips } from '../services.jsx/trips.jsx'
import { formatPounds } from '../utils/money.js'
import { remembered, remember } from '../utils/rememberBooking.js'
import { CONTACT_EMAIL } from '../utils/contact.js'
import '../css/customerBooking.css'

// The booking form customers use, on the booking page and the charter page (the dashboard has its own,
// BookingForm). Designed for a phone first: the day's trips as big cards showing the seats left, − and +
// buttons for the party, and the price adding up as they go (owner's choice, 1 Nov 2026). Then Stripe's
// page saves their card. The server checks everything again (utils/validateBooking.js).
// selectedDate: 'YYYY-MM-DD' from the calendar; charter: the charter page; prices: the normal prices in pounds.

const MAX_PER_FIELD = 12 // adults, children and infants, each (the server's limit too)
const MAX_SEATS = 12 // the boat's legal limit, for a charter
const DETAILS = ['firstName', 'lastName', 'email', 'phone', 'accommodation', 'message']

// 'Saturday 7 November 2026'
const longDate = (day) => parseDay(day)?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) || day

const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// One party size with − and + buttons around a box they can also type in
function Stepper({ id, label, hint, value, min, max, canAdd, onChange }) {
    const n = Number(value) || 0
    return (
        <div className='stepperRow'>
            <label htmlFor={id}>
                {label}
                <span className='stepperHint'>{hint}</span>
            </label>
            <div className='stepper'>
                <button type='button' className='stepBtn' aria-label={`Fewer ${label.toLowerCase()}`} disabled={n <= min}
                    onClick={() => onChange(String(Math.max(min, n - 1)))}>−</button>
                <input type='number' id={id} name={id} inputMode='numeric' min={min} max={max} value={value}
                    onChange={(e) => onChange(e.target.value)} />
                <button type='button' className='stepBtn' aria-label={`More ${label.toLowerCase()}`} disabled={n >= max || !canAdd}
                    onClick={() => onChange(String(Math.min(max, n + 1)))}>+</button>
            </div>
        </div>
    )
}

function CustomerBookingForm({ selectedDate, charter = false, prices }) {
    const [trips, setTrips] = useState(null) // null while loading, [] if none, or 'error'
    const [refresh, setRefresh] = useState(0) // bumped to reload the seats after the server says a trip is full
    const [timeslot, setTimeslot] = useState(null)
    const [party, setParty] = useState(() => ({ adults: '1', children: '0', infants: '0', ...remembered().party }))
    const [details, setDetails] = useState(() => ({ ...Object.fromEntries(DETAILS.map((key) => [key, ''])), ...remembered().details }))
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const errorBox = useRef(null)

    useEffect(() => {
        let current = true
        setTrips(null)
        getDayTrips(selectedDate)
            .then((dayTrips) => { if (current) setTrips(Array.isArray(dayTrips) ? dayTrips : 'error') })
            .catch(() => { if (current) setTrips('error') })
        return () => { current = false }
    }, [selectedDate, refresh])

    useEffect(() => { remember({ party, details }) }, [party, details])
    useEffect(() => { if (error) errorBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [error])

    // A charter needs the whole trip, and extra trips are sold by the seat, so the charter page leaves them out
    const offered = Array.isArray(trips) ? trips.filter((trip) => !(charter && trip.extra)) : []
    const bookable = (trip) => trip.open && (charter ? trip.charterFree : trip.spaces > 0)
    // The chosen trip: the one they picked if it can still be booked, otherwise the first one that can
    const chosen = offered.find((trip) => trip.timeslot === timeslot && bookable(trip)) || offered.find(bookable) || null

    const counts = { adults: Number(party.adults) || 0, children: Number(party.children) || 0, infants: Number(party.infants) || 0 }
    const seats = counts.adults + counts.children + counts.infants
    const limit = charter ? MAX_SEATS : chosen?.spaces ?? MAX_SEATS
    const tooMany = seats > limit
    const partyProblem = counts.adults < 1 ? 'Please add at least 1 adult.' : tooMany
        ? (charter ? `A charter can take up to ${MAX_SEATS} people, infants included.` : `Only ${people(limit)} can book this trip now (infants take a seat too).`)
        : null

    // What it will cost: an extra trip has its own prices; a charter is a flat price for the boat
    const tripPrices = chosen?.extra ? { adult: Number(chosen.prices.adult), child: Number(chosen.prices.child) } : prices
    const total = charter ? prices?.charter : tripPrices ? counts.adults * tripPrices.adult + counts.children * tripPrices.child : null
    const breakdown = charter ? 'for the whole boat, up to 12 people' : tripPrices ? [
        `${plural(counts.adults, 'adult', 'adults')} × ${formatPounds(tripPrices.adult)}`,
        ...(counts.children ? [`${plural(counts.children, 'child', 'children')} × ${formatPounds(tripPrices.child)}`] : []),
        ...(counts.infants ? [`${plural(counts.infants, 'infant', 'infants')} free`] : []),
    ].join(' + ') : null

    const setCount = (key) => (value) => setParty({ ...party, [key]: value })
    const setDetail = (key) => (e) => setDetails({ ...details, [key]: e.target.value })

    const submit = async (e) => {
        e.preventDefault()
        if (!chosen || partyProblem) return
        setSubmitting(true)
        setError(null)
        const booking = {
            date: selectedDate, timeslot: chosen.timeslot, ...party, ...details,
            website_url: e.target.website_url?.value, // the hidden field only bots fill in
        }
        try {
            const res = await axios.post(`${URL}/${charter ? 'charters/create-checkout-session' : 'bookings/checkout'}`, booking)
            if (res.data.url) {
                window.location.href = res.data.url // Stripe's page; the booking is made once the card is saved
                return
            }
            setError(res.data.data)
            setRefresh((n) => n + 1) // most likely the trip filled up: show the seats as they are now
        } catch (err) {
            setError(err.response?.data?.data || "Sorry, we couldn't start your booking. Nothing has been charged. Please try again, or contact us to book.")
        } finally {
            setSubmitting(false)
        }
    }

    // How a trip's card describes itself
    const cardStatus = (trip) => {
        if (!trip.open) return { text: 'Booking closed', full: true }
        if (charter) return trip.charterFree ? { text: 'Available' } : { text: 'Not available', full: true }
        if (trip.spaces <= 0) return { text: 'Full', full: true }
        return { text: `${plural(trip.spaces, 'space', 'spaces')} left`, few: trip.spaces <= 4 }
    }
    const usualTime = (trip) => ({ '11am': '11am', '2pm': '2pm' })[trip.timeslot]

    return (
        <section className='customerBooking' aria-label={charter ? 'Book a private charter' : 'Book a trip'}>
            <form onSubmit={submit}>
                <fieldset className='bookStep'>
                    <legend><span className='stepNumber'>2</span> Choose {charter ? 'a time' : 'a trip'}</legend>
                    <p className='chosenDay'>{longDate(selectedDate)}</p>
                    {trips === null ? <p className='muted' role='status'>Loading the trips…</p> : null}
                    {trips === 'error' ? <p role='alert'>We couldn&apos;t load the trips for this day. Please try again, or contact us to book.</p> : null}
                    {Array.isArray(trips) && !offered.length ? <p>There are no trips on this day.</p> : null}
                    <div className='tripCards'>
                        {offered.map((trip) => {
                            const status = cardStatus(trip)
                            const selected = chosen?.timeslot === trip.timeslot
                            return (
                                <label key={trip.timeslot} className={`tripCard${selected ? ' selected' : ''}${status.full ? ' full' : ''}`}>
                                    <input type='radio' name='timeslot' value={trip.timeslot} checked={selected} disabled={status.full}
                                        onChange={() => setTimeslot(trip.timeslot)} />
                                    <span className='tripCardMain'>
                                        <span className='tripCardTime'>
                                            <strong className={trip.timeChanged ? 'movedTime' : undefined}>{trip.time}</strong>
                                            {trip.timeChanged ? <s className='usualTime'><span className='sr-only'>moved from </span>{usualTime(trip)}</s> : null}
                                        </span>
                                        {trip.extra ? <span className='tripCardName'>{trip.name}</span> : null}
                                        <span className={`tripCardSpaces${status.few ? ' few' : ''}`}>{status.text}</span>
                                    </span>
                                    {trip.extra ? (
                                        <span className='tripCardMore'>
                                            {formatPounds(Number(trip.prices.adult))} adults, {formatPounds(Number(trip.prices.child))} children, about {plural(Number(trip.hours), 'hour', 'hours')}
                                        </span>
                                    ) : null}
                                    {trip.harbourChanged ? <span className='tripCardMore'>Leaves from the <strong>{trip.harbour}</strong></span> : null}
                                </label>
                            )
                        })}
                    </div>
                    {chosen?.extra && chosen.note ? <p className='tripNote extraTripNote'><strong>{chosen.name}:</strong> {chosen.note}</p> : null}
                    {Array.isArray(trips) && offered.length && !chosen ? (
                        <p className='muted'>{charter ? 'No timeslots available today, please choose another day.' :'Every trip on this day is full or closed. Please choose another day, or contact us.'}</p>
                    ) : null}
                    {/* Charters can run at other times by arrangement (owner, 7 Nov 2026): the email starts with the day */}
                    {charter && Array.isArray(trips) ? (
                        <p className='otherTime'>
                            Looking for a different time?{' '}
                            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Charter on ${longDate(selectedDate).replace(',', '')}, another time`)}`}>Contact us</a>
                        </p>
                    ) : null}
                </fieldset>

                <fieldset className='bookStep' disabled={!chosen}>
                    <legend><span className='stepNumber'>3</span> Who&apos;s coming?</legend>
                    <Stepper id='adults' label='Adults' hint='15 and over' value={party.adults} min={1} max={MAX_PER_FIELD} canAdd={seats < limit} onChange={setCount('adults')} />
                    <Stepper id='children' label='Children' hint='4 to 14' value={party.children} min={0} max={MAX_PER_FIELD} canAdd={seats < limit} onChange={setCount('children')} />
                    <Stepper id='infants' label='Infants' hint='3 and under, free' value={party.infants} min={0} max={MAX_PER_FIELD} canAdd={seats < limit} onChange={setCount('infants')} />
                    {partyProblem ? <p className='partyProblem' role='alert'>{partyProblem}</p> : null}
                    {total != null && !partyProblem ? (
                        <p className='priceTotal' aria-live='polite'>
                            <span>Total <strong>{formatPounds(total)}</strong></span>
                            <span className='priceBreakdown'>{breakdown}</span>
                        </p>
                    ) : null}
                </fieldset>

                <fieldset className='bookStep' disabled={!chosen}>
                    <legend><span className='stepNumber'>4</span> Your details</legend>
                    <div className='fieldPair'>
                        <label>First name
                            <input type='text' id='firstName' name='firstName' value={details.firstName} onChange={setDetail('firstName')} required autoComplete='given-name' maxLength='100' />
                        </label>
                        <label>Last name
                            <input type='text' id='lastName' name='lastName' value={details.lastName} onChange={setDetail('lastName')} required autoComplete='family-name' maxLength='100' />
                        </label>
                    </div>
                    <label>Email
                        <input type='email' id='email' name='email' value={details.email} onChange={setDetail('email')} required autoComplete='email' inputMode='email' maxLength='254' />
                    </label>
                    <label>Mobile number <span className='fieldHint'>with country code, in case we need to reach you on the day</span>
                        <input type='tel' id='phone' name='phone' value={details.phone} onChange={setDetail('phone')} required autoComplete='tel' placeholder='+44 7700 900123' maxLength='40' />
                    </label>
                    <label>Where are you staying on Sark? <span className='fieldHint'>optional</span>
                        <input type='text' id='accommodation' name='accommodation' value={details.accommodation} onChange={setDetail('accommodation')} maxLength='200' />
                    </label>
                    <label>Anything we should know? <span className='fieldHint'>optional, e.g. mobility needs{charter ? ', or what you\'d like to do on your charter' : ''}</span>
                        <textarea id='message' name='message' rows='3' value={details.message} onChange={setDetail('message')} maxLength='1000' />
                    </label>
                </fieldset>

                {/* Hidden from people (off-screen, skipped by Tab and screen readers); bots tend to fill it in */}
                <div aria-hidden='true' className='honeypot'>
                    <label htmlFor='website_url'>Leave this field empty</label>
                    <input type='text' id='website_url' name='website_url' tabIndex={-1} autoComplete='off' />
                </div>

                {error ? <p className='formError' role='alert' ref={errorBox}>{error}</p> : null}

                {chosen && !partyProblem ? (
                    <p className='bookingSummary'>
                        <strong>{longDate(selectedDate)}</strong>, {chosen.extra ? chosen.name : charter ? `${chosen.time} charter` : `${chosen.time} trip`}
                        {chosen.extra ? ` at ${chosen.time}` : ''}, {people(seats)}{total != null ? <>: <strong>{formatPounds(total)}</strong></> : null}
                    </p>
                ) : null}

                <button className='continueBtn' type='submit' disabled={submitting || !chosen || Boolean(partyProblem)}>
                    {submitting ? 'Opening the card page…' : 'Continue to card details'}
                </button>

                <p className='cardNotice'>
                    Next you&apos;ll save a card on Stripe&apos;s secure page. <strong>Nothing is charged now:</strong> the
                    price is charged when your {charter ? 'charter' : 'trip'} starts. You can cancel free of charge
                    up to {charter ? FREE_CANCEL_HOURS.charter : FREE_CANCEL_HOURS.trip} hours before, and if we cancel
                    because of the weather, you won&apos;t be charged. <a href='/terms' target='_blank' rel='noopener'>Terms and conditions</a>
                </p>
            </form>
        </section>
    )
}

export default CustomerBookingForm
