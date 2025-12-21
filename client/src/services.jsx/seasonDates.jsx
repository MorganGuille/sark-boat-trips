import axios from "axios";
import {URL} from '../../config'

export const getSeasonDates = async () => {
    const res = await axios.get(`${URL}/admin/getSeasonDates`);
    return res.data;
};
