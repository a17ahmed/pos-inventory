import express from 'express';
import { authorize } from '../middleware/rbac.mjs';
import { uploadSupplyReceipt } from '../middleware/upload.mjs';
import {
    createSupply,
    getAllSupplies,
    getSupply,
    updateSupply,
    recordPayment,
    deleteSupply,
    getSupplyStats
} from '../controllers/supply.mjs';

const supplyRouter = express.Router();

supplyRouter.get('/stats', authorize('admin', 'manager'), getSupplyStats);
supplyRouter.post('/', authorize('admin', 'manager'), uploadSupplyReceipt, createSupply);
supplyRouter.get('/', getAllSupplies);
supplyRouter.get('/:id', getSupply);
supplyRouter.patch('/:id', authorize('admin', 'manager'), uploadSupplyReceipt, updateSupply);
supplyRouter.patch('/:id/pay', authorize('admin', 'manager'), recordPayment);
supplyRouter.delete('/:id', authorize('admin'), deleteSupply);

export default supplyRouter;
