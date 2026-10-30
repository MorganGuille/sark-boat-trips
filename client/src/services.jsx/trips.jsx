import axios from "axios";
import { URL } from '../../config'
import { authAxios } from './auth.jsx'

// The usual trips (11am and 2pm, from the Creux Harbour) as they are on one day: the owner may have
// moved one to another time or harbour. Public, for the booking page and the dashboard.
// Each is { timeslot, time, startTime, timeChanged, harbour, harbourKey, harbourChanged }.
export const getDayTrips = async (date) => {
    const res = await axios.get(`${URL}/bookings/trips/${date}`);
    return res.data.data;
};

// Dashboard: move one trip for that day. { date, timeslot, startTime: '15:00', harbour, note, notifyCustomers }
export const changeTrip = async (change) => {
    const res = await authAxios.post(`${URL}/bookings/change-trip`, change);
    return res.data;
};

// The usual trips, for when the day's trips can't be loaded
export const USUAL_TRIPS = [
    { timeslot: '11am', time: '11am', startTime: '11:00', timeChanged: false, harbour: 'Creux Harbour', harbourKey: 'creux', harbourChanged: false },
    { timeslot: '2pm', time: '2pm', startTime: '14:00', timeChanged: false, harbour: 'Creux Harbour', harbourKey: 'creux', harbourChanged: false },
];
