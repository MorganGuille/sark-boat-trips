import { useState } from 'react'
import usePage from '../hooks/usePage'
import MyCalendar from './myCalendar'
import CustomerBookingForm from './customerBookingForm'
import useSeasonDates from '../hooks/useSeasonDates'
import usePrices from '../hooks/usePrices'
import { formatPounds } from '../utils/money.js'
import { FREE_CANCEL_HOURS } from '../utils/policy.js'
import { toDay } from '../utils/dates.js'
import '../css/bookings.css'

// The booking section: on the home page, the /bookings page and the charter page (which books a private
// charter). On a phone it is one column: prices, the calendar, then the form. On a wider screen the
// calendar sits on the left and stays in view while the form scrolls past it.
function Bookings() {
    const pathname = usePage()
    const charter = pathname === '/charters'
    const season = useSeasonDates()
    const { prices } = usePrices()
    // The day picked on the calendar. Until they pick one: the first day that can be booked.
    const [picked, setPicked] = useState(null)

    const heading = charter ? 'Book a private charter' : 'Book a trip'
    // The /bookings page is the whole page, so it clears the site's navbar; elsewhere it follows other sections
    const className = `bookings${pathname === '/bookings' ? ' bookingsPage' : ''}`
    // The /bookings page's own title and description, in every state: the page is prebuilt while it still
    // says "Loading calendar…", and that is what search engines read (spec P2-9)
    const head = pathname === '/bookings' ? (<>
        <title>Sark Boat Trips | Book a Trip</title>
        <meta name="description" content={`Book a boat trip around Sark online: pick a day and a trip, see the seats left, and pay when your trip starts. Free cancellation up to ${FREE_CANCEL_HOURS.trip} hours before.`} />
    </>) : null

    if (season.status === 'loading') {
        return (
            <section className={className} aria-label={heading}>
                {head}
                <p className='bookingsWait' aria-live="polite" aria-busy="true">Loading calendar…</p>
            </section>
        )
    }

    const today = toDay(new Date())
    const firstDay = season.status === 'ready' ? (season.start > today ? season.start : today) : null
    const over = firstDay && firstDay > season.end

    if (season.status !== 'ready' || over) {
        return (
            <section className={className} aria-label={heading}>
                {head}
                <div className='bookingsIntro' role="status">
                    <h2>{heading}</h2>
                    <p>
                        {season.status === 'notSet' ? "Bookings aren't open yet. Please check back soon."
                            : over ? "This season's trips are over. Thank you, and see you next year!"
                                : "We couldn't load the booking calendar. Please refresh the page or try again shortly."}
                    </p>
                </div>
            </section>
        )
    }

    const selectedDate = picked || firstDay

    return (
        <section className={className} aria-label={heading}>
            {head}
            <div className='bookingsIntro'>
                <h2>{heading}</h2>
                {prices ? (
                    <ul className='priceChips' aria-label='Prices'>
                        {charter ? (
                            <li><strong>{formatPounds(prices.charter)}</strong> for the whole boat, up to 12 people</li>
                        ) : (<>
                            <li>Adults <strong>{formatPounds(prices.adult)}</strong></li>
                            <li>Children (4 to 14) <strong>{formatPounds(prices.child)}</strong></li>
                            <li>Infants (3 and under) <strong>free</strong></li>
                        </>)}
                    </ul>
                ) : null}
                {/* How paying works, in three points (owner, 2 Nov 2026) */}
                <ul className='bookingPoints' aria-label='How paying works'>
                    <li><strong>Save a card:</strong> nothing taken now</li>
                    <li><strong>Charged</strong> when your {charter ? 'charter' : 'trip'} starts</li>
                    <li><strong>Free cancellation</strong> up to {charter ? FREE_CANCEL_HOURS.charter : FREE_CANCEL_HOURS.trip} hours before</li>
                </ul>
                {charter ? null : <p className='bookingsSmall'>Special trips (like a swim or sunset trip) show their own price.</p>}
            </div>

            <div className='bookingsGrid'>
                <div className='bookingsSide'>
                    <h3 className='stepTitle'><span className='stepNumber'>1</span> Choose a day</h3>
                    <MyCalendar
                        setSelectedDate={setPicked}
                        seasonStartDate={season.start}
                        seasonEndDate={season.end}
                        initialDate={firstDay}
                        dayPanel={false}
                    />
                    <ul className='calendarKey' aria-label='What the colours mean'>
                        <li><span className='keySwatch available' aria-hidden='true'></span>Spaces</li>
                        <li><span className='keySwatch partially-booked' aria-hidden='true'></span>Filling up</li>
                        <li><span className='keySwatch fully-booked' aria-hidden='true'></span>Full</li>
                    </ul>
                </div>

                <CustomerBookingForm selectedDate={selectedDate} charter={charter} prices={prices} />
            </div>
        </section>
    )
}

export default Bookings
