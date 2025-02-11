import React from 'react'
import { useState } from 'react';
import Calendar from 'react-calendar';
import axios from 'axios'
import 'react-calendar/dist/Calendar.css';
import '../css/myCalendar.css'

function MyCalendar() {

    const [date, setDate] = useState(new Date())
    const [availability, setAvailability] = useState(null)

    const getAvailability = async (date) => {

        console.log(date)

        let formattedDate = date.toISOString().slice(0, 10)

        console.log("this is the date:", formattedDate)

        try {
            console.log("trying")
            const res = await axios.get(`http://localhost:4040/bookings/availability/${formattedDate}`)
            setAvailability(res.data.data)
            console.log(res.data)
            console.error
        }
        catch (error) {
            console.log(error)
        }
    }

    const onChange = date => {
        setDate(date)
        getAvailability(date)


    }

    return (<>
        <section className="calendar">
            <Calendar onChange={onChange} value={date} />
            <div className='calendarDisplay'>
                <p>Seats availiable</p>
                <p>{availability}</p>
            </div>
        </section>
    </>

    )
}

export default MyCalendar