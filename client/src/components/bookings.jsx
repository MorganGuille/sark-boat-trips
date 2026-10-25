import { useState } from 'react'
import MyCalendar from './myCalendar'
import BookingForm from './bookingForm'
import useSeasonDates from '../hooks/useSeasonDates'
import usePrices from '../hooks/usePrices'
import { formatPounds } from '../utils/money.js'
import { toDay } from '../utils/dates.js'
import '../css/bookings.css'

function Bookings() {

    const [selectedDate, setSelectedDate] = useState(toDay(new Date()))
    const season = useSeasonDates()
    const { prices } = usePrices()

    if (season.status === 'loading') {
        return <div aria-live="polite" aria-busy="true">Loading calendar…</div>;
    }

    if (season.status !== 'ready') {
        return (
            <section className="bookings" aria-label="Booking and Availability">
                <div role="status">
                    <h2 className='textArea'>Make a Reservation</h2>
                    <p className='textArea'>
                        {season.status === 'notSet'
                            ? "Bookings aren't open yet. Please check back soon."
                            : "We couldn't load the booking calendar. Please refresh the page or try again shortly."}
                    </p>
                </div>
            </section>
        )
    }

    return (
        <section className="bookings" aria-label="Booking and Availability">
            <div>
                <h2 className='textArea'>Make a Reservation</h2>
                <p className='textArea'>Please use the calendar to select a date and then fill out the form to make a booking</p>


                {prices ? (
                    <div className='textArea' aria-label="Pricing information">
                        <p>Prices are :</p>
                        <p>
                            <strong>Adults</strong>: {formatPounds(prices.adult)}<br />
                            <strong>Children</strong> (3-14 yrs): {formatPounds(prices.child)}<br />
                            <strong>Infants</strong>: free
                        </p>
                        <p><strong>Private Charter</strong>: {formatPounds(prices.charter)}</p>
                    </div>
                ) : null}

                <MyCalendar
                    setSelectedDate={setSelectedDate}
                    seasonStartDate={season.start}
                    seasonEndDate={season.end}
                />
            </div>

            <BookingForm selectedDate={selectedDate} />
        </section>
    )
}

export default Bookings