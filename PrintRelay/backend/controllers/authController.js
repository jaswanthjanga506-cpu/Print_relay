import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Shop } from '../models/Shop.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { userDTO, ownerShopDTO } from '../utils/dto.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/token.js';
import { defaultHours } from '../validators/shop.validators.js';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('printrelay-dummy-password', 10);

async function respondWithSession(res, user, status = 200) {
  setAuthCookie(res, signToken(user));
  const body = { user: userDTO(user) };
  if (user.role === 'shop_owner') {
    const shop = await Shop.findOne({ owner: user._id });
    body.shop = shop ? ownerShopDTO(shop) : null;
  }
  res.status(status).json({ data: body });
}

const emailTaken = () => ApiError.conflict('An account with this email already exists', undefined, 'EMAIL_TAKEN');

export const registerCustomer = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw emailTaken();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, phone, passwordHash, role: 'customer' });
  await respondWithSession(res, user, 201);
});

export const registerShopOwner = asyncHandler(async (req, res) => {
  const { name, email, password, phone, shop } = req.body;
  if (await User.exists({ email })) throw emailTaken();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, phone, passwordHash, role: 'shop_owner' });
  try {
    await Shop.create({ ...shop, hours: shop.hours || defaultHours(), owner: user._id, approvalStatus: 'PENDING' });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }
  await respondWithSession(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw ApiError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('This account has been suspended.', 'ACCOUNT_SUSPENDED');
  await respondWithSession(res, user);
});

export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  res.json({ data: { ok: true } });
});

export const me = asyncHandler(async (req, res) => {
  const body = { user: userDTO(req.user) };
  if (req.user.role === 'shop_owner') {
    const shop = await Shop.findOne({ owner: req.user._id });
    body.shop = shop ? ownerShopDTO(shop) : null;
  }
  res.json({ data: body });
});

export const updateProfile = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ data: { user: userDTO(req.user) } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Your current password is incorrect', undefined, 'WRONG_PASSWORD');
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
  await user.save();
  res.json({ data: { ok: true } });
});
