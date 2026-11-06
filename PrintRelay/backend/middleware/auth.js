import { User } from '../models/User.js';
import { Shop } from '../models/Shop.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/token.js';
import { COOKIE_NAME } from '../utils/constants.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.');
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('This account has been suspended.', 'ACCOUNT_SUSPENDED');
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());

// Loads the shop owned by the signed-in shop owner. Every shop-scoped query uses req.shop._id.
export const loadOwnShop = asyncHandler(async (req, _res, next) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw ApiError.notFound('No shop is linked to this account');
  req.shop = shop;
  next();
});

export const requireApprovedShop = (req, _res, next) =>
  req.shop?.approvalStatus === 'APPROVED'
    ? next()
    : next(ApiError.forbidden('Your shop must be approved by an administrator first.', 'SHOP_NOT_APPROVED'));
