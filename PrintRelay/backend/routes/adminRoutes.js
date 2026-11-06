import { Router } from 'express';
import * as c from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { adminShopQuery, adminUserQuery, shopStatusSchema, userStatusSchema } from '../validators/admin.validators.js';
import { adminOrderQuery } from '../validators/order.validators.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));
r.get('/dashboard', c.dashboard);
r.get('/shops', validate(adminShopQuery, 'query'), c.listShops);
r.patch('/shops/:id/status', validateObjectId('id'), validate(shopStatusSchema), c.setShopStatus);
r.get('/users', validate(adminUserQuery, 'query'), c.listUsers);
r.patch('/users/:id/status', validateObjectId('id'), validate(userStatusSchema), c.setUserStatus);
r.get('/orders', validate(adminOrderQuery, 'query'), c.listOrders);
export default r;
