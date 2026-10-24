import axios from "axios";
import {URL} from '../../config'
import { authAxios } from './auth.jsx'

export const getSeasonDates = async () => {
    const res = await axios.get(`${URL}/admin/getSeasonDates`);
    return res.data;
};

export const setSeasonDates = async (seasonStartDate, seasonEndDate) => {
    const res = await authAxios.post(`${URL}/admin/setSeasonDates`, { seasonStartDate, seasonEndDate });
    return res.data;
};
