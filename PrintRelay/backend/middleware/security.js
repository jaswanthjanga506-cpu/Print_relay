import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';
import { CSRF_HEADER_VALUE } from '../utils/constants.js';
import { env } from '../config/env.js';

const limiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max: env.isTest ? 10000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, message, undefined, 'RATE_LIMITED')),
  });

export const apiLimiter = limiter(15 * 60 * 1000, 600, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60 * 1000, 30, 'Too many attempts. Please try again in a few minutes.');
export const uploadLimiter = limiter(60 * 60 * 1000, 40, 'Upload limit reached. Please try again later.');
export const pickupLimiter = limiter(15 * 60 * 1000, 60, 'Too many verification attempts. Please wait a moment.');

// Cookie auth + cross-site deployment => require a custom header on state-changing requests.
// A custom header forces a CORS preflight, which only our allow-listed origins pass (CSRF defence).
export function requireCsrfHeader(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== CSRF_HEADER_VALUE) {
    return next(ApiError.forbidden('Missing required request header', 'CSRF_HEADER_MISSING'));
  }
  next();
}
