import api from '../api';

// ─── Create / Read ───────────────────────────────────────────
export const createBill = (data) => api.post('/bill', data);
export const getBills = (params) => api.get('/bill', { params });
export const getBill = (id) => api.get(`/bill/${id}`);
export const updateBill = (id, data) => api.patch(`/bill/${id}`, data);

// ─── Payments ────────────────────────────────────────────────
export const addBillPayment = (id, data) => api.post(`/bill/${id}/payment`, data);

// ─── Stats / Top Products ────────────────────────────────────
export const getBillStats = (params) => api.get('/bill/stats', { params });
export const getTopProducts = (limit = 12) => api.get(`/bill/top-products?limit=${limit}`);
