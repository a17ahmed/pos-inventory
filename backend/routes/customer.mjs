import express from 'express';
import {
    createOrGetCustomer,
    getCustomers,
    searchCustomers
} from '../controllers/customer.mjs';

const router = express.Router();

router.post('/', createOrGetCustomer);
router.get('/', getCustomers);
router.get('/search', searchCustomers);

export default router;
