import express from 'express';
import { validate } from '../middleware/validate.mjs';
import { updateAdminSchema, updateBusinessSettingsSchema } from '../middleware/validationSchemas.mjs';

import { getAdmin, getAdminEmail, patchAdmin, deleteAdmin, updateBusinessSettings, getBusinessSettings } from '../controllers/admin.mjs';

const adminRouter = express.Router();

adminRouter
    .get('/business/settings', getBusinessSettings)
    .get('/email/:email', getAdminEmail)
    .get('/:id', getAdmin)
    .patch('/:id', validate(updateAdminSchema), patchAdmin)
    .put('/business/settings', validate(updateBusinessSettingsSchema), updateBusinessSettings)
    .delete('/:id', deleteAdmin);

export default adminRouter;
