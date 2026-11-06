import { Router } from 'express';
import * as c from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateObjectId } from '../middleware/validate.js';
import { notificationQuery } from '../validators/notification.validators.js';

const r = Router();
r.use(requireAuth);
r.get('/', validate(notificationQuery, 'query'), c.list);
r.get('/unread-count', c.unreadCount);
r.patch('/read-all', c.markAllRead);
r.patch('/:id/read', validateObjectId('id'), c.markRead);
export default r;
