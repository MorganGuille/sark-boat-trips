import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import axios from 'axios';
// import 'react-calendar/dist/Calendar.css';  for default styles 
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

            newAvailability[formattedDate] = {
                '11am': null,
                '2pm': null,
            };

            try {
                const res = await axios.get(`http://localhost:4040/bookings/availability/${formattedDate}`);
                newAvailability[formattedDate]['11am'] = res.data.data['11am'];
                newAvailability[formattedDate]['2pm'] = res.data.data['2pm'];
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
        if (view === 'month') {
            const formattedDate = formatDate(date);
            const tileAvailability = availability[formattedDate];

            if (!tileAvailability) {
                return null;
            }

            const available11am = tileAvailability['11am'];
            const available2pm = tileAvailability['2pm'];

            if (available11am === 0 && available2pm === 0) {
                return 'fully-booked';
            } else if (available11am < 12 || available2pm < 12) {
                return 'partially-booked';
            } else {
                return 'available';
            }
        }
        return null;
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
                <div>
                    <p>11:00 AM: </p>
                    <p>{availability[formatDate(date)]?.['11am'] === null ? "Loading..." : availability[formatDate(date)]?.['11am']} spaces available</p>
                </div>
                <div>
                    <p>2:00 PM: </p>
                    <p>{availability[formatDate(date)]?.['2pm'] === null ? "Loading..." : availability[formatDate(date)]?.['2pm']} spaces available</p>
                </div>
            </div>
        </section>
    );
}

export default MyCalendar;
