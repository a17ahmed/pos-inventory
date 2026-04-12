import express from 'express';
import { validate } from '../middleware/validate.mjs';
import {
    createEmployeeSchema,
    updateEmployeeSchema,
    resetEmployeePasswordSchema,
    updateWorkStatusSchema,
    employeeLoginSchema,
    employeeChangePasswordSchema,
} from '../middleware/validationSchemas.mjs';
import {
    getAllEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeCount,
    resetEmployeePassword,
    getBusinessPrefixForEmployee,
    checkEmployeeIdAvailable,
    updateWorkStatus
} from '../controllers/employee.mjs';
import { employeeLogin, employeeChangePassword } from '../controllers/employeeAuth.mjs';

const employeeRouter = express.Router();

// Get business prefix for employee ID
employeeRouter.get('/prefix', getBusinessPrefixForEmployee);

// Check if employee ID is available
employeeRouter.get('/check-id', checkEmployeeIdAvailable);

// Get all employees (uses businessId from JWT)
employeeRouter.get('/', getAllEmployees);

// Get employee count
employeeRouter.get('/count', getEmployeeCount);

// Get single employee
employeeRouter.get('/:id', getEmployeeById);

// Create new employee
employeeRouter.post('/', validate(createEmployeeSchema), createEmployee);

// Update employee
employeeRouter.patch('/:id', validate(updateEmployeeSchema), updateEmployee);

// Update employee work status (Active/On Break/Busy)
employeeRouter.patch('/:id/status', validate(updateWorkStatusSchema), updateWorkStatus);

// Reset employee password (admin function)
employeeRouter.post('/:id/reset-password', validate(resetEmployeePasswordSchema), resetEmployeePassword);

// Delete employee
employeeRouter.delete('/:id', deleteEmployee);

export default employeeRouter;

// Separate router for employee auth (no auth required)
export const employeeAuthRouter = express.Router();

// Employee login
employeeAuthRouter.post('/login', validate(employeeLoginSchema), employeeLogin);

// Employee change password
employeeAuthRouter.post('/change-password', validate(employeeChangePasswordSchema), employeeChangePassword);
