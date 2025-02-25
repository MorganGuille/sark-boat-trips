import { useState } from 'react'
import MyCalendar from './myCalendar'
import BookingForm from './bookingForm'
import '../css/bookings.css'

function Bookings() {

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${day}-${month}-${year}`;
    };

    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))


    return (<>

        <section className="bookings">
            <div>
                <p className='textArea'>Please use the calendar to select a date and then fill out the form to make a booking</p>
                <MyCalendar setSelectedDate={setSelectedDate} />

            </div>
            <BookingForm selectedDate={selectedDate} />
        </section>
    </>
    )
}

export default Bookings
