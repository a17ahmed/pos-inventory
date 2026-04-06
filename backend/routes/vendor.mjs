import express from 'express';
import { authorize } from '../middleware/rbac.mjs';
import { createVendor, getAllVendors, getVendor, updateVendor, deleteVendor } from '../controllers/vendor.mjs';

const vendorRouter = express.Router();

vendorRouter.post('/', authorize('admin', 'manager'), createVendor);
vendorRouter.get('/', getAllVendors);
vendorRouter.get('/:id', getVendor);
vendorRouter.patch('/:id', authorize('admin', 'manager'), updateVendor);
vendorRouter.delete('/:id', authorize('admin'), deleteVendor);

export default vendorRouter;
