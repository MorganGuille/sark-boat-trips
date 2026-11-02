import axios from "axios";
import { URL } from '../../config'
import { authAxios } from './auth.jsx'

// Public: the Gift vouchers page sends the buyer to Stripe; the thank-you page checks the payment
export const startVoucherCheckout = async (order) => (await axios.post(`${URL}/vouchers/checkout`, order)).data;
export const verifyVoucher = async (sessionId) => (await axios.get(`${URL}/vouchers/verify`, { params: { session_id: sessionId } })).data;

// Dashboard
export const listVouchers = async (q = '') => (await authAxios.get(`${URL}/vouchers`, { params: q ? { q } : {} })).data;
export const addVoucher = async (voucher) => (await authAxios.post(`${URL}/vouchers/add`, voucher)).data;
export const markVoucherUsed = async (_id, reference) => (await authAxios.post(`${URL}/vouchers/use`, { _id, reference })).data;
export const undoVoucher = async (_id) => (await authAxios.post(`${URL}/vouchers/undo`, { _id })).data;
export const resendVoucher = async (_id, to) => (await authAxios.post(`${URL}/vouchers/resend`, { _id, to })).data;
export const extendVoucher = async (_id, expiresOn) => (await authAxios.post(`${URL}/vouchers/extend`, { _id, expiresOn })).data;

// Fetches the PDF with the owner's login and hands it to the browser as a download
export const downloadVoucher = async (voucher) => {
    const res = await authAxios.get(`${URL}/vouchers/${voucher._id}/pdf`, { responseType: 'blob' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(res.data);
    link.download = `sark-boat-trips-gift-voucher-${voucher.code}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(link.href);
};
