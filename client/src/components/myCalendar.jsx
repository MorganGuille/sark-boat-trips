import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import axios from 'axios';
// import 'react-calendar/dist/Calendar.css';
import '../css/myCalendar.css';

function MyCalendar({ setSelectedDate }) {
    const [date, setDate] = useState(new Date());
    const [availability, setAvailability] = useState({});

    useEffect(() => {
        fetchMonthAvailability(date);
    }, [date]);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
    };

    const fetchMonthAvailability = async (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const newAvailability = {};

        for (let day = firstDayOfMonth.getDate(); day <= lastDayOfMonth.getDate(); day++) {
            const currentDate = new Date(year, month, day);
            const formattedDate = formatDate(currentDate);

            try {
                const res = await axios.get(`http://localhost:4040/bookings/availability/${formattedDate}`);
                newAvailability[formattedDate] = res.data.data;
            } catch (error) {
                console.error(error);
                newAvailability[formattedDate] = null;
            }
        }

        setAvailability(newAvailability);
    };

    const onChange = (date) => {
        setDate(date);
        setSelectedDate(formatDate(date))
    };

    const setTileClassName = ({ date, view }) => {
        const formattedDate = formatDate(date);
        const tileAvailability = availability[formattedDate];

        if (tileAvailability === undefined || tileAvailability === null) {
            return '';
        }

        if (view === 'month') {
            if (tileAvailability === 0) {
                return 'fully-booked';
            } else if (tileAvailability < 24) {
                return 'partially-booked';
            } else {
                return 'available';
            }
        }
    };

    const formattedDate = formatDate(date);

    return (
        <section className="calendar">
            <Calendar
                onActiveStartDateChange={({ activeStartDate }) => onChange(activeStartDate)}
                onChange={onChange}
                value={date}
                tileClassName={setTileClassName}
                showNeighboringMonth={true}
                maxDetail="month"
                minDetail="year"
                next2Label={null}
                prev2Label={null}
            />
            <div className="calendarDisplay">
                <p>Seats available</p>
                <p>{availability[formattedDate] === undefined ? 'Loading...' : availability[formattedDate]}</p>
            </div>
        </section>
    );
}

export default MyCalendar;
