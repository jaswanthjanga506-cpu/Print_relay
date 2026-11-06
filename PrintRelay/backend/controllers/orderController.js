import QRCode from 'qrcode';
import { Order } from '../models/Order.js';
import { OrderEvent } from '../models/OrderEvent.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { eventDTO, orderDTO } from '../utils/dto.js';
import { IN_PROGRESS_STATUSES } from '../utils/constants.js';
import * as orders from '../services/orderService.js';
import { PRICING_NOTE } from '../services/pricingService.js';
import { getQueueInfo } from '../services/queueService.js';
import { deriveCode, deriveToken, qrPayload } from '../services/pickupService.js';

const SHOP_FIELDS = 'name address phone';

export const quote = asyncHandler(async (req, res) => {
  const { price, selection } = await orders.resolveOrderInput(req.user, req.body, { requireUnclaimed: false });
  res.json({ data: { pricing: price, selectedPages: selection.selectedPages, pageSelection: selection, note: PRICING_NOTE } });
});

export const create = asyncHandler(async (req, res) => {
  const order = await orders.createOrder(req.user, req.body);
  await order.populate('shop', SHOP_FIELDS);
  res.status(201).json({ data: { ...orderDTO(order.toObject()), queue: null, pricingNote: PRICING_NOTE } });
});

export const list = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = { customer: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  else if (req.query.active) filter.status = { $in: IN_PROGRESS_STATUSES };
  if (req.query.q) filter.orderNumber = new RegExp(escapeRegex(req.query.q), 'i');

  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('shop', SHOP_FIELDS).lean(),
    Order.countDocuments(filter),
  ]);
  const data = await Promise.all(items.map(async (o) => ({ ...orderDTO(o), queue: await getQueueInfo(o) })));
  res.json({ data, pagination: pageMeta(pg, total) });
});

export const getOne = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id }).populate('shop', SHOP_FIELDS).lean();
  if (!order) throw ApiError.notFound('Order not found');
  const [queue, events] = await Promise.all([getQueueInfo(order), OrderEvent.find({ order: order._id }).sort({ createdAt: 1 }).lean()]);
  res.json({
    data: {
      ...orderDTO(order),
      queue,
      events: events.map(eventDTO),
      pickupAvailable: order.status === 'READY_FOR_PICKUP' && !order.pickup?.usedAt,
    },
  });
});

export const pickup = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'READY_FOR_PICKUP' || order.pickup?.usedAt || !order.pickup?.nonce) {
    throw ApiError.conflict('A pickup code is only available while the order is ready for pickup.', undefined, 'PICKUP_UNAVAILABLE');
  }
  const token = deriveToken(order._id, order.pickup.nonce);
  const qrDataUrl = await QRCode.toDataURL(qrPayload(token), { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  res.set('Cache-Control', 'private, no-store');
  res.json({ data: { orderNumber: order.orderNumber, manualCode: deriveCode(order._id, order.pickup.nonce), qrDataUrl } });
});

export const cancel = asyncHandler(async (req, res) => {
  const order = await orders.customerCancel(req.user, req.params.id);
  await order.populate('shop', SHOP_FIELDS);
  res.json({ data: { ...orderDTO(order.toObject()), queue: null } });
});
