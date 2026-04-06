import express from 'express';

import { createAdmin, login, requestPasswordReset, verifyingOTP, resetPassword } from '../controllers/adminAuth.mjs';

const adminAuthRouter = express.Router();

adminAuthRouter.post('/', createAdmin);
adminAuthRouter.post('/login', login);
adminAuthRouter.post('/forgot-password', requestPasswordReset);
adminAuthRouter.post('/verifying-otp', verifyingOTP);
adminAuthRouter.post('/reset-password', resetPassword);


export default adminAuthRouter;