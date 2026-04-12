import express from 'express';
import { uploadSupplyReceipt } from '../middleware/upload.mjs';
import { validate } from '../middleware/validate.mjs';
import {
    supplyPaymentSchema,
    supplyReturnSchema,
} from '../middleware/validationSchemas.mjs';
import {
    createSupply,
    getAllSupplies,
    getSupply,
    updateSupply,
    recordPayment,
    deleteSupply,
    getSupplyStats,
    processSupplyReturn
} from '../controllers/supply.mjs';

const supplyRouter = express.Router();

supplyRouter.get('/stats', getSupplyStats);
supplyRouter.post('/', uploadSupplyReceipt, createSupply);
supplyRouter.get('/', getAllSupplies);
supplyRouter.get('/:id', getSupply);
supplyRouter.patch('/:id', uploadSupplyReceipt, updateSupply);
supplyRouter.patch('/:id/pay', validate(supplyPaymentSchema), recordPayment);
supplyRouter.post('/:id/return', validate(supplyReturnSchema), processSupplyReturn);
supplyRouter.delete('/:id', deleteSupply);

export default supplyRouter;
