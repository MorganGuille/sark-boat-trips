import React from 'react'
import { useState } from 'react';
import Calendar from 'react-calendar';
import axios from 'axios'
import 'react-calendar/dist/Calendar.css';
import '../css/myCalendar.css'

function MyCalendar() {

    const [date, setDate] = useState(new Date())
    const [availability, setAvailability] = useState()

    const getAvailability = async (req, res) => {

        console.log("this is the date:", date)

        axios.get('http://localhost:4040/availability/', {
            params: {
                date
            }
        })

        try {
            setAvailability(res.data)
        }
        catch (error) {
            console.log(error)
        }
    }

    const onChange = date => {
        setDate(date)


    }

    return (<>
        <section className="calendar">
            <Calendar onChange={() => { onChange(), getAvailability() }} value={date} />
            <div className='calendarDisplay'>
                <p>Seats availiable</p>
                <p>{availability}</p>
            </div>
        </section>
    </>

    )
}

export default MyCalendar