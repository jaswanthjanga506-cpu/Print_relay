import { Router } from 'express';
import * as c from '../controllers/shopOrderController.js';
import { requireApprovedShop } from '../middleware/auth.js';
import { pickupLimiter } from '../middleware/security.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { paymentSchema, reasonSchema, shopOrderQuery, verifyPickupSchema } from '../validators/order.validators.js';

const r = Router();
const id = validateObjectId('id');

r.get('/', validate(shopOrderQuery, 'query'), c.list);
r.get('/summary', c.summary);
r.post('/verify-pickup', pickupLimiter, requireApprovedShop, validate(verifyPickupSchema), c.verifyPickup);
r.get('/:id', id, c.getOne);

// All state-changing actions require an approved (not suspended) shop.
r.patch('/:id/accept', id, requireApprovedShop, c.accept);
r.patch('/:id/reject', id, requireApprovedShop, validate(reasonSchema), c.reject);
r.patch('/:id/start', id, requireApprovedShop, c.start);
r.patch('/:id/ready', id, requireApprovedShop, c.ready);
r.patch('/:id/cancel', id, requireApprovedShop, validate(reasonSchema), c.cancel);
r.patch('/:id/payment', id, requireApprovedShop, validate(paymentSchema), c.confirmPayment);
export default r;
