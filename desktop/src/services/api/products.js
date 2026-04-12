import api from '../api';

export const getProducts = () =>
    api.get('/product');

export const createProduct = (data) =>
    api.post('/product', data);

export const updateProduct = (id, data) =>
    api.patch(`/product/${id}`, data);

export const deleteProduct = (id) =>
    api.delete(`/product/${id}`);

export const getProductByBarcode = (barcode) =>
    api.get(`/product/barcode/${barcode}`);

export const getProductBySku = (sku) =>
    api.get(`/product/sku/${sku}`);

export const generateSku = () =>
    api.get('/product/generate-sku');

export const generateBarcode = () =>
    api.get('/product/generate-barcode');
