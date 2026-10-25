import axios from "axios";
import { URL } from '../../config'
import { authAxios } from './auth.jsx'

// Public: the booking page shows the prices. prices is null until the owner has set them.
export const getPrices = async () => {
    const res = await axios.get(`${URL}/admin/getPrices`);
    return res.data.prices;
};

export const setPrices = async (adultPrice, childPrice, charterPrice) => {
    const res = await authAxios.post(`${URL}/admin/setPrices`, { adultPrice, childPrice, charterPrice });
    return res.data;
};

// month is 'YYYY-MM'
export const getReport = async (month) => {
    const res = await authAxios.get(`${URL}/bookings/report/${month}`);
    return res.data;
};

// Fetches the CSV with the owner's login and hands it to the browser as a download
export const downloadReport = async (month) => {
    const res = await authAxios.get(`${URL}/bookings/report/${month}`, { params: { format: 'csv' }, responseType: 'blob' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(res.data);
    link.download = `sark-boat-trips-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(link.href);
};
