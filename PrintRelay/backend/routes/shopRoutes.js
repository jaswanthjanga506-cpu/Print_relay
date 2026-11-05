import { Router } from 'express';
import * as c from '../controllers/shopController.js';
import { loadOwnShop, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { availabilitySchema, offeringsSchema, updateShopProfileSchema } from '../validators/shop.validators.js';
import shopOrderRoutes from './shopOrderRoutes.js';

const r = Router();
r.use(requireAuth, requireRole('shop_owner'), loadOwnShop);
r.get('/me', c.getMyShop);
r.patch('/me', validate(updateShopProfileSchema), c.updateMyShop);
r.patch('/me/offerings', validate(offeringsSchema), c.updateOfferings);
r.patch('/me/availability', validate(availabilitySchema), c.updateAvailability);
r.use('/orders', shopOrderRoutes);
export default r;
