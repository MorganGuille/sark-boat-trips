import { useState } from 'react'
import MyCalendar from '../components/myCalendar'
import BookingForm from '../components/bookingForm'
import '../css/bookings.css'

function Bookings() {

    const [selectedDate, setSelectedDate] = useState({})

    return (<>
        <section className="bookings">
            <h1>Bookings</h1>
            <MyCalendar setSelectedDate={setSelectedDate} />
            <BookingForm selectedDate={selectedDate} />
        </section>

    </>

    )
}

export default Bookings