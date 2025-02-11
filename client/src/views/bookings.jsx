import React from 'react'
import MyCalendar from '../components/myCalendar'
import '../css/bookings.css'

function Bookings() {
    return (<>
        <section className="bookings">
            <h1>Bookings</h1>
            <MyCalendar />
        </section>

    </>

    )
}

export default Bookings