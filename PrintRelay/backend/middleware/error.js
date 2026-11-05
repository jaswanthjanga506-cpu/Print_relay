import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const notFoundHandler = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let details;
  let code = err.code && typeof err.code === 'string' ? err.code : undefined;

  if (err instanceof ApiError) {
    ({ status, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    message = err.issues[0]?.message || 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    code = 'VALIDATION_ERROR';
  } else if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = `File is too large. The maximum size is ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB.`;
    } else {
      status = 400;
      message = 'Upload failed. Send a single PDF in the "file" field.';
    }
    code = err.code;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Some fields are invalid';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'Invalid identifier';
  } else if (err?.code === 11000) {
    status = 409;
    message = 'That record already exists';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(status).json({ error: { message, ...(details ? { details } : {}), ...(code && status < 500 ? { code } : {}) } });
}
