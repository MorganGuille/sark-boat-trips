import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router'
import Calendar from 'react-calendar';
import axios from 'axios';

import '../css/myCalendar.css';
import { URL } from '../../config.js'

function MyCalendar({ setSelectedDate }) {
    const [date, setDate] = useState(new Date());
    const [availability, setAvailability] = useState({});

    let currentLoc = useLocation()

    const blockDateStart = () => {
        return currentLoc.pathname === '/dashboard' ? null : new Date("2025-05-01")
    }

    const blockDateEnd = () => {
        return currentLoc.pathname === '/dashboard' ? null : new Date("2025-09-30")
    }

    useEffect(() => {
        fetchMonthAvailability(date);
    }, [date]);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${day}-${month}-${year}`;
    };

    const fetchMonthAvailability = async (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const dates = [];

        for (let day = firstDayOfMonth.getDate(); day <= lastDayOfMonth.getDate(); day++) {
            const currentDate = new Date(year, month, day);
            dates.push(formatDate(currentDate))
        }
        try {
            const res = await axios.post(`${URL}/bookings/monthAvailability`, { dates });
            const availabilityData = res.data.data;

            const newAvailability = {};
            dates.forEach((formattedDate, index) => {
                if (availabilityData[index]) {
                    newAvailability[formattedDate] = {
                        '11am': availabilityData[index]['11am'],
                        '2pm': availabilityData[index]['2pm'],
                    };
                } else {
                    newAvailability[formattedDate] = null;
                }
            })

            setAvailability(newAvailability);

        } catch (error) {
            console.error(error);
            const newAvailability = {};
            dates.forEach((formattedDate) => {
                newAvailability[formattedDate] = null;
            });
            setAvailability(newAvailability);
        }
    }

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

    const color11am = () => {
        return availability[formatDate(date)]?.['11am'] > 6 ? 'green' : 'darkred'
    }

    const color2pm = () => {
        return availability[formatDate(date)]?.['2pm'] > 6 ? 'green' : 'darkred'
    }


    return (
        <section className="calendar">
            <Calendar
                onActiveStartDateChange={({ activeStartDate }) => onChange(activeStartDate)}
                onChange={() => [onChange]}
                onClickDay={onChange}
                value={date}
                tileClassName={setTileClassName}
                showNeighboringMonth={true}
                maxDetail="month"
                minDetail="year"
                next2Label={null}
                prev2Label={null}
                minDate={blockDateStart()}
                maxDate={blockDateEnd()}
            />
            <div className="calendarDisplay">
                <div>
                    <span >11:00 AM: </span>
                    <span style={{ color: color11am() }}>{!availability[formatDate(date)]?.['11am'] && availability[formatDate(date)]?.['11am'] != 0 ? <span className='loader'></span> : `${availability[formatDate(date)]?.['11am']} spaces available`}</span>
                </div>
                <div>
                    <span>2:00 PM: </span>
                    <span style={{ color: color2pm() }}>{!availability[formatDate(date)]?.['2pm'] && availability[formatDate(date)]?.['2pm'] != 0 ? <span className='loader'></span> : `${availability[formatDate(date)]?.['2pm']} spaces available`} </span>
                </div>

            </div>
        </section>
    );
}

export default MyCalendar;
