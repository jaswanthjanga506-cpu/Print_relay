import { User } from '../models/User.js';
import { Shop } from '../models/Shop.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { adminShopDTO, orderDTO, userDTO } from '../utils/dto.js';
import { ORDER_STATUSES } from '../utils/constants.js';
import { notify } from '../services/notificationService.js';

export const dashboard = asyncHandler(async (_req, res) => {
  const [customers, shopOwners, shopsByStatus, ordersByStatus] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'shop_owner' }),
    Shop.aggregate([{ $group: { _id: '$approvalStatus', n: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const toMap = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.find((r) => r._id === k)?.n || 0]));
  res.json({
    data: {
      users: { customers, shopOwners },
      shops: toMap(shopsByStatus, ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
      orders: toMap(ordersByStatus, ORDER_STATUSES),
    },
  });
});

export const listShops = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.approvalStatus = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { 'address.locality': rx }, { 'address.city': rx }];
  }
  const [items, total] = await Promise.all([
    Shop.find(filter).sort({ approvalStatus: 1, createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('owner', 'name email phone').lean(),
    Shop.countDocuments(filter),
  ]);
  res.json({ data: items.map(adminShopDTO), pagination: pageMeta(pg, total) });
});

export const setShopStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const shop = await Shop.findById(req.params.id);
  if (!shop) throw ApiError.notFound('Shop not found');
  if (shop.approvalStatus === status) throw ApiError.conflict(`This shop is already ${status.toLowerCase()}.`);

  shop.approvalStatus = status;
  shop.approvalNote = note;
  shop.reviewedBy = req.user._id;
  shop.reviewedAt = new Date();
  if (status !== 'APPROVED') shop.acceptingOrders = false; // hidden shops never take new orders
  await shop.save();

  const copy = {
    APPROVED: ['SHOP_APPROVED', 'Shop approved', `${shop.name} is now visible to customers. Set your prices and start accepting orders.`],
    REJECTED: ['SHOP_REJECTED', 'Shop registration rejected', `${shop.name} was rejected: ${note}`],
    SUSPENDED: ['SHOP_SUSPENDED', 'Shop suspended', `${shop.name} was suspended: ${note}`],
  }[status];
  await notify({ recipient: shop.owner, shop: shop._id, type: copy[0], title: copy[1], message: copy[2] });

  await shop.populate('owner', 'name email phone');
  res.json({ data: adminShopDTO(shop.toObject()) });
});

export const listUsers = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ data: items.map(userDTO), pagination: pageMeta(pg, total) });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden('Admin accounts cannot be suspended here.');
  user.status = req.body.status;
  await user.save();
  res.json({ data: userDTO(user) });
});

export const listOrders = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.shop) filter.shop = req.query.shop;
  if (req.query.q) filter.orderNumber = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .populate('customer', 'name phone').populate('shop', 'name address phone').lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ data: items.map((o) => orderDTO(o, 'admin')), pagination: pageMeta(pg, total) });
});
