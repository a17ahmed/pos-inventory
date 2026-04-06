import express from 'express';

import { getAdmin, getAdminEmail, patchAdmin, deleteAdmin, updateBusinessSettings, getBusinessSettings } from '../controllers/admin.mjs';

const adminRouter = express.Router();

adminRouter
    .get('/business/settings', getBusinessSettings)
    .get('/email/:email', getAdminEmail)
    .get('/:id', getAdmin)
    .patch('/:id', patchAdmin)
    .put('/business/settings', updateBusinessSettings)
    .delete('/:id', deleteAdmin);

export default adminRouter;
