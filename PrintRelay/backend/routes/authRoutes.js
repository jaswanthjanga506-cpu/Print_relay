import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema, loginSchema, registerCustomerSchema, registerShopOwnerSchema, updateProfileSchema,
} from '../validators/auth.validators.js';

const r = Router();
r.post('/register/customer', authLimiter, validate(registerCustomerSchema), c.registerCustomer);
r.post('/register/shop-owner', authLimiter, validate(registerShopOwnerSchema), c.registerShopOwner);
r.post('/login', authLimiter, validate(loginSchema), c.login);
r.post('/logout', c.logout);
r.get('/me', requireAuth, c.me);
r.patch('/profile', requireAuth, validate(updateProfileSchema), c.updateProfile);
r.patch('/password', requireAuth, authLimiter, validate(changePasswordSchema), c.changePassword);
export default r;
