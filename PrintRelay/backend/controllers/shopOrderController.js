import { Order } from '../models/Order.js';
import { OrderEvent } from '../models/OrderEvent.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { eventDTO, orderDTO } from '../utils/dto.js';
import { ACTIVE_QUEUE_STATUSES, HISTORY_STATUSES } from '../utils/constants.js';
import * as orders from '../services/orderService.js';
import { getQueueInfo } from '../services/queueService.js';

const CUSTOMER_FIELDS = 'name phone';
const SHOP_FIELDS = 'name address phone';

const SECTIONS = {
  requests: { filter: { status: 'PENDING' }, sort: { createdAt: 1 } },
  queue: { filter: { status: { $in: ACTIVE_QUEUE_STATUSES } }, sort: { queueSequence: 1 } },
  ready: { filter: { status: 'READY_FOR_PICKUP' }, sort: { readyAt: 1 } },
  history: { filter: { status: { $in: HISTORY_STATUSES } }, sort: { updatedAt: -1 } },
};

const shaped = async (order) => {
  await order.populate([{ path: 'customer', select: CUSTOMER_FIELDS }, { path: 'shop', select: SHOP_FIELDS }]);
  return { ...orderDTO(order.toObject(), 'shop_owner'), queue: await getQueueInfo(order) };
};

export const list = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const section = SECTIONS[req.query.section];
  const filter = { shop: req.shop._id, ...section.filter };
  if (req.query.q) filter.orderNumber = new RegExp(escapeRegex(req.query.q), 'i');

  const [items, total] = await Promise.all([
    Order.find(filter).sort(section.sort).skip(pg.skip).limit(pg.limit).populate('customer', CUSTOMER_FIELDS).lean(),
    Order.countDocuments(filter),
  ]);

  // In the queue view each row shows its real position.
  const data = await Promise.all(items.map(async (o) => ({ ...orderDTO(o, 'shop_owner'), queue: await getQueueInfo(o) })));
  res.json({ data, pagination: pageMeta(pg, total) });
});

export const summary = asyncHandler(async (req, res) => {
  const base = { shop: req.shop._id };
  const [requests, queue, ready, printing] = await Promise.all([
    Order.countDocuments({ ...base, ...SECTIONS.requests.filter }),
    Order.countDocuments({ ...base, ...SECTIONS.queue.filter }),
    Order.countDocuments({ ...base, ...SECTIONS.ready.filter }),
    Order.findOne({ ...base, status: 'PRINTING' }).select('orderNumber').lean(),
  ]);
  res.json({ data: { requests, queue, ready, printing: printing ? { id: String(printing._id), orderNumber: printing.orderNumber } : null } });
});

export const getOne = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id })
    .populate('customer', CUSTOMER_FIELDS).populate('shop', SHOP_FIELDS);
  if (!order) throw ApiError.notFound('Order not found');
  const events = await OrderEvent.find({ order: order._id }).sort({ createdAt: 1 }).lean();
  res.json({ data: { ...orderDTO(order.toObject(), 'shop_owner'), queue: await getQueueInfo(order), events: events.map(eventDTO) } });
});

const action = (fn) => asyncHandler(async (req, res) => {
  const order = await fn(req);
  res.json({ data: await shaped(order) });
});

export const accept = action((req) => orders.acceptOrder(req.shop, req.user, req.params.id));
export const reject = action((req) => orders.rejectOrder(req.shop, req.user, req.params.id, req.body.reason));
export const cancel = action((req) => orders.cancelAccepted(req.shop, req.user, req.params.id, req.body.reason));
export const start = action((req) => orders.startPrinting(req.shop, req.user, req.params.id));
export const ready = action((req) => orders.markReady(req.shop, req.user, req.params.id));
export const confirmPayment = action((req) => orders.confirmPayment(req.shop, req.user, req.params.id, req.body.upiReference));

export const verifyPickup = asyncHandler(async (req, res) => {
  const { order, collected } = await orders.verifyPickup(req.shop, req.user, req.body);
  res.json({ data: { collected, order: await shaped(order) } });
});
