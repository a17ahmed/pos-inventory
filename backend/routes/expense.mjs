import express from 'express';
import { authorize } from '../middleware/rbac.mjs';

import {
    createExpense,
    getAllExpenses,
    getExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    getExpenseStats
} from '../controllers/expense.mjs';

const expenseRouter = express.Router();

// Stats endpoint (must be before /:id to avoid conflict)
expenseRouter.get('/stats', getExpenseStats);

// CRUD endpoints
expenseRouter
    // Create expense - admin and manager only
    .post('/', authorize('admin', 'manager'), createExpense)
    // List expenses - all authenticated users can view
    .get('/', getAllExpenses)
    // Get single expense
    .get('/:id', getExpense)
    // Update expense - admin and manager only (controller checks pending status)
    .patch('/:id', authorize('admin', 'manager'), updateExpense)
    // Delete expense - admin only
    .delete('/:id', authorize('admin'), deleteExpense);

// Approval endpoints - admin only
expenseRouter
    .post('/:id/approve', authorize('admin'), approveExpense)
    .post('/:id/reject', authorize('admin'), rejectExpense);

export default expenseRouter;
