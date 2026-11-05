import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function secret(name) {
  const value = process.env[name];
  if (value && value.length >= 32) return value;
  if (isProd) throw new Error(`${name} must be set to a random string of at least 32 characters in production`);
  if (!isTest) console.warn(`[env] ${name} missing or short - using an insecure development fallback`);
  return `dev-insecure-${name.toLowerCase()}-fallback-value-0123456789`;
}

const configuredClientOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
const localDevOrigins = isProd ? [] : [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const clientOrigins = [...new Set([...configuredClientOrigins, ...localDevOrigins])];

if (isProd && clientOrigins.some((o) => o === '*')) throw new Error('CLIENT_ORIGINS must list exact origins in production');

export const env = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: secret('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  pickupSecret: secret('PICKUP_SECRET'),
  clientOrigins,
  cookieSameSite: process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax'),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024,
  maxPdfPages: Number(process.env.MAX_PDF_PAGES) || 500,
};
