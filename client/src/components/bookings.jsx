import { useState, useEffect } from 'react'
import MyCalendar from './myCalendar'
import BookingForm from './bookingForm'
import { getSeasonDates } from '../services.jsx/seasonDates'
import '../css/bookings.css'

function Bookings() {

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${day}-${month}-${year}`;
    };

    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
    const [seasonStartDate, setSeasonStartDate] = useState('')
    const [seasonEndDate, setSeasonEndDate] = useState('')

    useEffect(() => {
        const fetchDates = async () => {
            try {
                const res = await getSeasonDates()
                if (res) {
                    setSeasonStartDate(res.seasonStartDate);
                    setSeasonEndDate(res.seasonEndDate);
                }
            }
            catch (error) {
                console.error(error)
            }
        }
        fetchDates()
    }, [])

    if (!seasonStartDate || !seasonEndDate) {
        return <div aria-live="polite" aria-busy="true">Loading calendar…</div>;
    }

    return (
        <section className="bookings" aria-label="Booking and Availability">
            <div>
                <h2 className='textArea'>Make a Reservation</h2>
                <p className='textArea'>Please use the calendar to select a date and then fill out the form to make a booking</p>


                <div className='textArea' aria-label="Pricing information">
                    <p>Prices for 2026 are :</p>
                    <p>
                        <strong>Adults</strong>: £40<br />
                        <strong>Children</strong> (3-14 yrs): £25<br />
                        <strong>Infants</strong>: free
                    </p>
                    <p><strong>Private Charter</strong>: £400</p>
                </div>

                <MyCalendar
                    setSelectedDate={setSelectedDate}
                    seasonStartDate={seasonStartDate}
                    seasonEndDate={seasonEndDate}
                />
            </div>

            <BookingForm selectedDate={selectedDate} />
        </section>
    )
}

export default Bookings