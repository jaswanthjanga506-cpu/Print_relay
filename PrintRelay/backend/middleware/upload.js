import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Memory storage is fine at a 10 MB cap; the real validation happens in pdfService.
export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    const looksLikePdf = /\.pdf$/i.test(file.originalname || '');
    if (!looksLikePdf) return cb(ApiError.unprocessable('Only PDF files are accepted.', undefined, 'NOT_PDF'));
    cb(null, true);
  },
}).single('file');
