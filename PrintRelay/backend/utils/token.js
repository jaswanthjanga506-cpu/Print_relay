import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { COOKIE_NAME } from './constants.js';

export const signToken = (user) =>
  jwt.sign({ role: user.role }, env.jwtSecret, { subject: String(user._id), expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

const cookieBase = () => ({
  httpOnly: true,
  secure: env.isProd || env.cookieSameSite === 'none',
  sameSite: env.cookieSameSite,
  path: '/',
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
});

export const setAuthCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, { ...cookieBase(), maxAge: 7 * 24 * 60 * 60 * 1000 });

export const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, cookieBase());
