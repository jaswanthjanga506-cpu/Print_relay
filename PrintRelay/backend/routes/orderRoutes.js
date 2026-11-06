import { Router } from 'express';
import * as c from '../controllers/orderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { createOrderSchema, customerOrderQuery, quoteSchema } from '../validators/order.validators.js';

const r = Router();
r.use(requireAuth, requireRole('customer'));
r.post('/quote', validate(quoteSchema), c.quote);
r.post('/', validate(createOrderSchema), c.create);
r.get('/', validate(customerOrderQuery, 'query'), c.list);
r.get('/:id', validateObjectId('id'), c.getOne);
r.get('/:id/pickup', validateObjectId('id'), c.pickup);
r.patch('/:id/cancel', validateObjectId('id'), c.cancel);
export default r;
