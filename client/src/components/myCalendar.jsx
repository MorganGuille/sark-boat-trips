import { useState, useEffect, useMemo } from 'react';
import usePage from '../hooks/usePage'
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

// dayPanel: the box under the calendar listing the chosen day's trips and spaces (the dashboard's;
// the customer pages show trip cards in the booking form instead). initialDate: the day to start on.
// value: the chosen day ('YYYY-MM-DD') when it can also be chosen elsewhere (the dashboard's Open day).
// On the customer pages days before today, or outside the season, can't be picked.
function MyCalendar({ setSelectedDate, seasonStartDate, seasonEndDate, refreshKey, dayPanel = true, initialDate, value }) {
    const [ownDate, setDate] = useState(() => (initialDate && parseDay(initialDate)) || new Date());
    const date = useMemo(() => (value && parseDay(value)) || ownDate, [value, ownDate]);
    const [availability, setAvailability] = useState({});
    // The chosen day's trips: the owner may have moved one to another time or harbour that day
    const [trips, setTrips] = useState(USUAL_TRIPS);

    const page = usePage()

    // The first day a customer can pick: the season's first day, or today if the season has begun
    const dbseasonStartDate = useMemo(() => {
        if (page === '/dashboard') return null;
        if (!seasonStartDate) return null;
        const today = parseDay(toDay(new Date()));
        const start = parseDay(seasonStartDate);
        return start > today ? start : today;
    }, [page, seasonStartDate]);

    const dbseasonEndDate = useMemo(() => {
        if (page === '/dashboard') return null;
        if (!seasonEndDate) return null;
        return parseDay(seasonEndDate);
    }, [page, seasonEndDate]);

    // stillWanted: false once another month has been asked for, so a slow answer can't replace a newer one
    const fetchMonthAvailability = async (date, stillWanted) => {
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
                        extras: availabilityData[index].extras || [], // { timeslot, spaces } of each extra trip
                    };
                } else {
                    newAvailability[formattedDate] = null;
                }
            })
            if (stillWanted()) setAvailability(newAvailability);
        } catch (error) {
            console.error(error);
            const newAvailability = {};
            dates.forEach((formattedDate) => {
                newAvailability[formattedDate] = null;
            });
            if (stillWanted()) setAvailability(newAvailability);
        }
    }

    const day = toDay(date);
    // The month's seats are asked for when the month changes (or the dashboard saves something), not on
    // every tap on a day: one tap used to cost the whole month again
    const month = day.slice(0, 7);
    useEffect(() => {
        let current = true;
        fetchMonthAvailability(parseDay(`${month}-01`), () => current);
        return () => { current = false; };
    }, [month, refreshKey]);

    // Extra trips are sold by the seat, so the charter page leaves them out
    const charterPage = page === '/charters';
    useEffect(() => {
        if (!dayPanel) return undefined; // the customer pages show the day's trips in the booking form, which asks for them itself
        let current = true;
        getDayTrips(day)
            .then((dayTrips) => { if (current && Array.isArray(dayTrips)) setTrips(dayTrips); })
            .catch(() => { if (current) setTrips(USUAL_TRIPS); });
        return () => { current = false; };
    }, [day, refreshKey, dayPanel]);
    // A moved trip shows its new time with the usual one crossed out underneath, like a departures board,
    // and an extra trip its name underneath. The harbour isn't shown here (no room, and the two harbours
    // are 100m apart): the booking form says it.
    const tripLabel = (trip) => {
        if (trip.extra) {
            return (
                <span className='tripTime'>
                    <span>{clock(trip.startTime)}:</span>
                    <span className='tripName'>{trip.name}</span>
                </span>
            );
        }
        if (!trip.timeChanged) return <span>{clock(trip.startTime)}: </span>;
        const usual = USUAL_TRIPS.find((t) => t.timeslot === trip.timeslot);
        return (
            <span className='tripTime'>
                <span className='movedTime'>{clock(trip.startTime)}:</span>
                <s className='usualTime'><span className='sr-only'>moved from </span>{clock(usual.startTime)}</s>
            </span>
        );
    };
    const shownTrips = trips.filter((trip) => !(charterPage && trip.extra));
    // Seats left on one of the chosen day's trips (undefined while loading)
    const spacesOn = (trip) => {
        const dayAvailability = availability[day];
        if (!dayAvailability) return undefined;
        return trip.extra ? dayAvailability.extras?.find((x) => x.timeslot === trip.timeslot)?.spaces : dayAvailability[trip.timeslot];
    };

    const handleDateChange = (date) => {
        setDate(date);
        setSelectedDate(toDay(date))
    };

    // Moving to another month picks its first day, or the first day that can be picked in it
    const handleMonthChange = (firstOfMonth) => {
        if (dbseasonStartDate && firstOfMonth < dbseasonStartDate) return handleDateChange(dbseasonStartDate);
        if (dbseasonEndDate && firstOfMonth > dbseasonEndDate) return handleDateChange(dbseasonEndDate);
        handleDateChange(firstOfMonth);
    };

    const setTileClassName = ({ date, view }) => {
        if (view === 'month') {
            const formattedDate = toDay(date);
            const tileAvailability = availability[formattedDate];
            if (!tileAvailability) return null;

            const available11am = tileAvailability['11am'];
            const available2pm = tileAvailability['2pm'];
            const extras = charterPage ? [] : tileAvailability.extras || [];

            if (available11am === 0 && available2pm === 0 && extras.every((x) => x.spaces <= 0)) return 'fully-booked';
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
                        {!charterPage && tileAvailability.extras?.length ? ` ${tileAvailability.extras.length} extra trip${tileAvailability.extras.length === 1 ? '' : 's'}.` : ''}
                    </span>
                );
            }
        }
        return null;
    };


    return (
        <section className="calendar-container" aria-label="Trip Availability Calendar">
            <div className="calendar-wrapper">
                <Calendar
                    onActiveStartDateChange={({ action, activeStartDate }) => { if (action !== 'onChange') handleMonthChange(activeStartDate) }}
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

            {dayPanel ? <div
                className="calendarDisplay"
                aria-live="polite"
                aria-atomic="true"
            >
                <p>Availability for : {date.toDateString()}:</p>
                {shownTrips.map((trip) => {
                    const spaces = spacesOn(trip);
                    return (
                        <div key={trip.timeslot}>
                            {tripLabel(trip)}
                            <span style={{ color: spaces > 6 ? 'green' : 'darkred' }}>
                                {spaces === undefined
                                    ? <span className='loader' aria-label="Loading spaces"></span>
                                    : `${spaces} spaces available`}
                            </span>
                        </div>
                    );
                })}
            </div> : null}
        </section>
    );
}

export default MyCalendar;