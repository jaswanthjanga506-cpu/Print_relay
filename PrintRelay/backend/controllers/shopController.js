import { Shop } from '../models/Shop.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { ownerShopDTO, publicShopDTO } from '../utils/dto.js';
import { ACTIVE_QUEUE_STATUSES } from '../utils/constants.js';

/* ----------------------- public discovery ----------------------- */

export const listShops = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query, { defaultLimit: 12, maxLimit: 30 });
  const filter = { approvalStatus: 'APPROVED' };

  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { 'address.locality': rx }, { 'address.city': rx }];
  }
  if (req.query.service) {
    const map = { bw: 'services.bw', colour: 'services.colour', spiral: 'services.spiralBinding' };
    for (const s of req.query.service.split(',').map((x) => x.trim())) if (map[s]) filter[map[s]] = true;
  }
  if (req.query.accepting) filter.acceptingOrders = req.query.accepting === 'true';

  const [shops, total] = await Promise.all([
    Shop.find(filter).sort({ acceptingOrders: -1, name: 1 }).skip(pg.skip).limit(pg.limit).lean(),
    Shop.countDocuments(filter),
  ]);

  // Real queue lengths for just this page of shops.
  const counts = await Order.aggregate([
    { $match: { shop: { $in: shops.map((s) => s._id) }, status: { $in: ACTIVE_QUEUE_STATUSES } } },
    { $group: { _id: '$shop', n: { $sum: 1 } } },
  ]);
  const byShop = new Map(counts.map((c) => [String(c._id), c.n]));

  res.json({ data: shops.map((s) => publicShopDTO(s, byShop.get(String(s._id)) || 0)), pagination: pageMeta(pg, total) });
});

export const getShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ _id: req.params.id, approvalStatus: 'APPROVED' }).lean();
  if (!shop) throw ApiError.notFound('Shop not found');
  const activeQueue = await Order.countDocuments({ shop: shop._id, status: { $in: ACTIVE_QUEUE_STATUSES } });
  res.json({ data: publicShopDTO(shop, activeQueue) });
});

/* ------------------------ shop owner area ------------------------ */

export const getMyShop = asyncHandler(async (req, res) => res.json({ data: ownerShopDTO(req.shop) }));

export const updateMyShop = asyncHandler(async (req, res) => {
  const { address, ...rest } = req.body;
  Object.assign(req.shop, rest);
  if (address) req.shop.address = { ...req.shop.address.toObject(), ...address };
  await req.shop.save();
  res.json({ data: ownerShopDTO(req.shop) });
});

export const updateOfferings = asyncHandler(async (req, res) => {
  req.shop.services = req.body.services;
  req.shop.pricing = req.body.pricing;
  // If the shop stops offering anything usable, stop accepting orders.
  await req.shop.save();
  res.json({ data: ownerShopDTO(req.shop) });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const { isOpen, acceptingOrders } = req.body;
  if (acceptingOrders === true) {
    if (req.shop.approvalStatus !== 'APPROVED') {
      throw ApiError.forbidden('Your shop must be approved before it can accept orders.', 'SHOP_NOT_APPROVED');
    }
    const { services, pricing } = req.shop;
    const usable = (services.bw && pricing.bwPerSidePaise > 0) || (services.colour && pricing.colourPerSidePaise > 0);
    if (!usable) throw ApiError.unprocessable('Set your services and prices before accepting orders.', undefined, 'SHOP_NOT_CONFIGURED');
  }
  if (isOpen !== undefined) req.shop.isOpen = isOpen;
  if (acceptingOrders !== undefined) req.shop.acceptingOrders = acceptingOrders;
  await req.shop.save();
  res.json({ data: ownerShopDTO(req.shop) });
});
