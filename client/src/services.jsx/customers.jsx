import { URL } from '../../config'
import { authAxios } from './auth.jsx'

// Dashboard: everything held for one customer's email, as a download, or erased (spec P2-13)
export const getCustomer = async (email) => (await authAxios.get(`${URL}/customers`, { params: { email } })).data;
export const eraseCustomer = async (email, confirm) => (await authAxios.post(`${URL}/customers/erase`, { email, confirm })).data;

// Fetches the file with the owner's login and hands it to the browser as a download
export const downloadCustomer = async (email) => {
    const res = await authAxios.get(`${URL}/customers/export`, { params: { email }, responseType: 'blob' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(res.data);
    link.download = `sark-boat-trips-${email}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(link.href);
};
