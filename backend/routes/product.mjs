import express from 'express';

import {
    createProduct,
    getAllProducts,
    getProduct,
    getProductByBarcode,
    updateProduct,
    deleteProduct,
    updateStock,
    bulkUpdateStock,
    getCategories,
    getLowStockProducts,
    generateBarcode
} from '../controllers/product.mjs';

const productRouter = express.Router();

productRouter
    .post('/', createProduct)
    .get('/', getAllProducts)
    .get('/categories', getCategories)
    .get('/low-stock', getLowStockProducts)
    .get('/generate-barcode', generateBarcode)
    .get('/barcode/:barcode', getProductByBarcode)
    .get('/:id', getProduct)
    .patch('/:id', updateProduct)
    .patch('/:id/stock', updateStock)
    .post('/bulk-stock', bulkUpdateStock)
    .delete('/:id', deleteProduct);

export default productRouter;
