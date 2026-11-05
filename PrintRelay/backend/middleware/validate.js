import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return next(ApiError.badRequest(details[0]?.message || 'Validation failed', details, 'VALIDATION_ERROR'));
  }
  req[source] = result.data;
  next();
};

export const validateObjectId = (...params) => (req, _res, next) => {
  for (const p of params) {
    if (!mongoose.isValidObjectId(req.params[p]) || String(req.params[p]).length !== 24) {
      return next(ApiError.notFound());
    }
  }
  next();
};
