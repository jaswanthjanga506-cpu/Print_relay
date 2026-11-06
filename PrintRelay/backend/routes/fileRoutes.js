import { Router } from 'express';
import { downloadFile, uploadFile } from '../controllers/fileController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/security.js';
import { uploadPdf } from '../middleware/upload.js';
import { validateObjectId } from '../middleware/validate.js';

const r = Router();
r.use(requireAuth);
r.post('/', requireRole('customer'), uploadLimiter, uploadPdf, uploadFile);
r.get('/:fileId', requireRole('customer', 'shop_owner'), validateObjectId('fileId'), downloadFile);
export default r;
