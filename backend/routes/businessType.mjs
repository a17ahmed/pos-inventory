import express from 'express';
import { getBusinessTypes, getBusinessTypeByCode, createBusinessType } from '../controllers/businessType.mjs';

const businessTypeRouter = express.Router();

// Public routes (no auth required for fetching types)
businessTypeRouter.get('/', getBusinessTypes);
businessTypeRouter.get('/:code', getBusinessTypeByCode);

// Protected route (for admin to add new types)
businessTypeRouter.post('/', createBusinessType);

export default businessTypeRouter;
