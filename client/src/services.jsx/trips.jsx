import axios from "axios";
import { URL } from '../../config'
import { authAxios } from './auth.jsx'

// The trips on one day, in time order: the usual 11am and 2pm (the owner may have moved one to another
// time or harbour) and any extra trips the owner added. Public, for the booking page and the dashboard.
// Each is { timeslot, time, label, startTime, timeChanged, harbour, harbourKey, harbourChanged, extra },
// and an extra trip also has { name, note, hours, prices: { adult, child } } (prices in pounds).
export const getDayTrips = async (date) => {
    const res = await axios.get(`${URL}/bookings/trips/${date}`);
    return res.data.data;
};

// Dashboard: move one trip for that day. { date, timeslot, startTime: '15:00', harbour, note, notifyCustomers }
export const changeTrip = async (change) => {
    const res = await authAxios.post(`${URL}/bookings/change-trip`, change);
    return res.data;
};

// Dashboard: email everyone booked on one trip. { date, timeslot, message }
export const messageTrip = async (body) => {
    const res = await authAxios.post(`${URL}/bookings/message-trip`, body);
    return res.data;
};

// Dashboard: add an extra trip to one day.
// { date, name, note, startTime: '16:30', harbour, hours, capacity, adultPrice, childPrice } (prices in pounds)
export const addTrip = async (trip) => {
    const res = await authAxios.post(`${URL}/bookings/add-trip`, trip);
    return res.data;
};

// Dashboard: change an extra trip. { date, timeslot, ...the same details as addTrip, notifyCustomers }
export const editTrip = async (trip) => {
    const res = await authAxios.post(`${URL}/bookings/edit-trip`, trip);
    return res.data;
};

// Dashboard: delete an extra trip (refused while anyone is booked on it). { date, timeslot }
export const removeTrip = async (body) => {
    const res = await authAxios.post(`${URL}/bookings/remove-trip`, body);
    return res.data;
};

// A trip in a sentence: 'the 11am trip', 'the Swim trip (4:30pm)'
export const tripName = (trip) => trip.extra ? trip.label : `${trip.time} trip`;

// The usual trips, for when the day's trips can't be loaded
export const USUAL_TRIPS = [
    { timeslot: '11am', time: '11am', label: '11am', startTime: '11:00', timeChanged: false, harbour: 'Creux Harbour', harbourKey: 'creux', harbourChanged: false, extra: false },
    { timeslot: '2pm', time: '2pm', label: '2pm', startTime: '14:00', timeChanged: false, harbour: 'Creux Harbour', harbourKey: 'creux', harbourChanged: false, extra: false },
];
