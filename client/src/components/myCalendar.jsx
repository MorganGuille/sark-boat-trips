import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router'
import Calendar from 'react-calendar';
import axios from 'axios';

import '../css/myCalendar.css';
import { URL } from '../../config.js'
import { parseDay, toDay } from '../utils/dates.js'
import { getDayTrips, USUAL_TRIPS } from '../services.jsx/trips.jsx'

// '15:00' as the calendar shows times: '3:00 PM'
const clock = (startTime) => {
    const [hour, minute] = startTime.split(':').map(Number)
    return `${((hour + 11) % 12) + 1}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

function MyCalendar({ setSelectedDate, seasonStartDate, seasonEndDate, refreshKey }) {
    const [date, setDate] = useState(new Date());
    const [availability, setAvailability] = useState({});
    // The chosen day's trips: the owner may have moved one to another time or harbour that day
    const [trips, setTrips] = useState(USUAL_TRIPS);

    let currentLoc = useLocation()

    const dbseasonStartDate = useMemo(() => {
        if (currentLoc.pathname === '/dashboard') return null;
        if (!seasonStartDate) return null;
        return parseDay(seasonStartDate);
    }, [currentLoc.pathname, seasonStartDate]);

    const dbseasonEndDate = useMemo(() => {
        if (currentLoc.pathname === '/dashboard') return null;
        if (!seasonEndDate) return null;
        return parseDay(seasonEndDate);
    }, [currentLoc.pathname, seasonEndDate]);

    const fetchMonthAvailability = async (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const dates = [];
        for (let day = firstDayOfMonth.getDate(); day <= lastDayOfMonth.getDate(); day++) {
            const currentDate = new Date(year, month, day);
            dates.push(toDay(currentDate))
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

    useEffect(() => {
        fetchMonthAvailability(date);
    }, [date, refreshKey]);

    const day = toDay(date);
    useEffect(() => {
        let current = true;
        getDayTrips(day)
            .then((dayTrips) => { if (current && Array.isArray(dayTrips)) setTrips(dayTrips); })
            .catch(() => { if (current) setTrips(USUAL_TRIPS); });
        return () => { current = false; };
    }, [day, refreshKey]);
    const tripLabel = (slot) => {
        const trip = trips.find((t) => t.timeslot === slot) || USUAL_TRIPS.find((t) => t.timeslot === slot);
        // the harbour isn't shown here (no room, and the two harbours are 100m apart): the booking form says it
        return `${clock(trip.startTime)}${trip.timeChanged ? ` (moved from ${slot})` : ''}: `;
    };

    const handleDateChange = (date) => {
        setDate(date);
        setSelectedDate(toDay(date))
    };

    const setTileClassName = ({ date, view }) => {
        if (view === 'month') {
            const formattedDate = toDay(date);
            const tileAvailability = availability[formattedDate];
            if (!tileAvailability) return null;

            const available11am = tileAvailability['11am'];
            const available2pm = tileAvailability['2pm'];

            if (available11am === 0 && available2pm === 0) return 'fully-booked';
            if (available11am < 12 || available2pm < 12) return 'partially-booked';
            return 'available';
        }
        return null;
    };

    const setTileContent = ({ date, view }) => {
        if (view === 'month') {
            const formattedDate = toDay(date);
            const tileAvailability = availability[formattedDate];
            if (tileAvailability) {
                return (
                    <span className="sr-only">
                        {tileAvailability['11am']} spaces at 11am, {tileAvailability['2pm']} spaces at 2pm.
                    </span>
                );
            }
        }
        return null;
    };

    const color11am = () => availability[toDay(date)]?.['11am'] > 6 ? 'green' : 'darkred';
    const color2pm = () => availability[toDay(date)]?.['2pm'] > 6 ? 'green' : 'darkred';

    return (
        <section className="calendar-container" aria-label="Trip Availability Calendar">
            <div className="calendar-wrapper">
                <Calendar
                    onActiveStartDateChange={({ activeStartDate }) => handleDateChange(activeStartDate)}
                    onChange={handleDateChange}
                    onClickDay={handleDateChange}
                    value={date}
                    tileClassName={setTileClassName}
                    tileContent={setTileContent}
                    showNeighboringMonth={true}
                    maxDetail="month"
                    minDetail="year"
                    next2Label={null}
                    prev2Label={null}
                    minDate={dbseasonStartDate}
                    maxDate={dbseasonEndDate}
                    inputRef={(ref) => ref && ref.setAttribute('aria-label', 'Select a date for your boat trip')}
                />
            </div>

            <div
                className="calendarDisplay"
                aria-live="polite"
                aria-atomic="true"
            >
                <p>Availability for : {date.toDateString()}:</p>
                <div>
                    <span>{tripLabel('11am')}</span>
                    <span style={{ color: color11am() }}>
                        {!availability[toDay(date)] && availability[toDay(date)] !== 0
                            ? <span className='loader' aria-label="Loading spaces"></span>
                            : `${availability[toDay(date)]?.['11am']} spaces available`}
                    </span>
                </div>
                <div>
                    <span>{tripLabel('2pm')}</span>
                    <span style={{ color: color2pm() }}>
                        {!availability[toDay(date)] && availability[toDay(date)] !== 0
                            ? <span className='loader' aria-label="Loading spaces"></span>
                            : `${availability[toDay(date)]?.['2pm']} spaces available`}
                    </span>
                </div>
            </div>
        </section>
    );
}

export default MyCalendar;