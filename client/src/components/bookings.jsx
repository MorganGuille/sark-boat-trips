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
                <p className='textArea'>Prices for 2025 are :</p>
                <p className='textArea'><strong>Adults</strong>: £40<br /> <strong>Children</strong> (3-14 yrs):  £25 <strong>Infants</strong>: free</p>
                <p className='textArea'><strong>Private Charter</strong> £400 </p>
                <MyCalendar setSelectedDate={setSelectedDate} />

            </div>
            <BookingForm selectedDate={selectedDate} />
        </section>
    </>
    )
}

export default Bookings
