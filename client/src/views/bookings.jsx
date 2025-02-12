import React from 'react'
import MyCalendar from '../components/myCalendar'
import BookingForm from '../components/bookingForm'
import '../css/bookings.css'

function Bookings() {
    return (<>
        <section className="bookings">
            <h1>Bookings</h1>
            <MyCalendar />
            <BookingForm />
        </section>

    </>

    )
}

export default Bookings