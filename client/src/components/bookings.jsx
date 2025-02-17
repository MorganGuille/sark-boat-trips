import { useState } from 'react'
import MyCalendar from './myCalendar'
import BookingForm from './bookingForm'
import '../css/bookings.css'

function Bookings() {

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))

    return (<>
        <section id='reservations' className="reservations">
            <h2>RESERVATIONS</h2>
            <p>Please note that we do not charge a deposit online - so if your plans change please let us know asap so
                we can rearrange your seat. Payment is on the day, at the end of the trip - either in cash or by card.
            </p>
        </section>
        <section className="bookings">
            <div>
                <p className='textArea'>Please use the calendar to select a date and then fill out the form to make a booking</p>
                <MyCalendar setSelectedDate={setSelectedDate} />
                <p className='textArea'>We dont require a deposit for bookings, so please let us know ASAP if you cannot make it!</p>
            </div>
            <BookingForm selectedDate={selectedDate} />
        </section>
    </>
    )
}

export default Bookings