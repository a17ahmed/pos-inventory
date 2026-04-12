import express from 'express';
import { authorize } from '../middleware/rbac.mjs';
import { validate } from '../middleware/validate.mjs';
import { updateAccessSchema } from '../middleware/validationSchemas.mjs';
import {
    getEmployeeAccess,
    updateEmployeeAccess,
    getAllAccess,
    deleteEmployeeAccess
} from '../controllers/access.mjs';

const accessRouter = express.Router();

// All access routes require admin or manager role
accessRouter.get('/', authorize('admin', 'manager'), getAllAccess);
accessRouter.get('/:employeeId', authorize('admin', 'manager'), getEmployeeAccess);
accessRouter.put('/:employeeId', authorize('admin', 'manager'), validate(updateAccessSchema), updateEmployeeAccess);
accessRouter.delete('/:employeeId', authorize('admin'), deleteEmployeeAccess);

export default accessRouter;
