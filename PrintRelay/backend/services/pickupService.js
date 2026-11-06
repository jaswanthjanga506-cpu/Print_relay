import crypto from 'crypto';
import { env } from '../config/env.js';

export const QR_PREFIX = 'printrelay:pickup:';

// Token and 6-digit code are derived from a server secret, the order id and a per-order nonce.
// The database stores only a hash of the token, so nothing usable is stored at rest.
const hmac = (label, orderId, nonce) =>
  crypto.createHmac('sha256', env.pickupSecret).update(`${label}:${orderId}:${nonce}`).digest();

export const newNonce = () => crypto.randomBytes(16).toString('hex');
export const deriveToken = (orderId, nonce) => hmac('token', String(orderId), nonce).toString('base64url');
export const deriveCode = (orderId, nonce) =>
  String(hmac('code', String(orderId), nonce).readUInt32BE(0) % 1_000_000).padStart(6, '0');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const qrPayload = (token) => `${QR_PREFIX}${token}`;
export const stripPrefix = (value) => (value.startsWith(QR_PREFIX) ? value.slice(QR_PREFIX.length) : value);

export const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};
