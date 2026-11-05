import { Order } from '../models/Order.js';
import { OrderEvent } from '../models/OrderEvent.js';
import { Shop } from '../models/Shop.js';
import { nextOrderNumber } from '../models/Counter.js';
import { filesCollection, toObjectId } from '../config/gridfs.js';
import { ApiError } from '../utils/ApiError.js';
import { ACTIVE_QUEUE_STATUSES, TRANSITIONS } from '../utils/constants.js';
import { resolveSelection } from './pageRanges.js';
import { computePrice } from './pricingService.js';
import { notify, broadcastOrderUpdate } from './notificationService.js';
import {
  deriveCode, deriveToken, hashToken, newNonce, safeEqual, stripPrefix,
} from './pickupService.js';

/* ---------------------------- helpers ---------------------------- */

export function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw ApiError.conflict(`An order that is ${from} cannot be changed to ${to}.`, undefined, 'INVALID_TRANSITION');
  }
}

async function loadShopOrder(shopId, orderId) {
  const order = await Order.findOne({ _id: orderId, shop: shopId });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

const record = (order, from, to, actor, note) =>
  OrderEvent.create({ order: order._id, previousStatus: from, newStatus: to, updatedBy: actor._id, updatedByRole: actor.role, note });

/**
 * Atomic status change: the update only matches if the order is still in the status we read,
 * so two concurrent requests can never both succeed.
 */
async function applyTransition(order, to, actor, { set = {}, note, filter = {} } = {}) {
  assertTransition(order.status, to);
  let updated;
  try {
    updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status, ...filter },
      { $set: { status: to, ...set } },
      { new: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      throw ApiError.conflict('Another order is already being printed. Mark it ready first.', undefined, 'ALREADY_PRINTING');
    }
    throw err;
  }
  if (!updated) throw ApiError.conflict('This order was just updated. Refresh and try again.', undefined, 'STALE_ORDER');
  await record(updated, order.status, to, actor, note);
  return updated;
}

/* ------------------------ customer: create ----------------------- */

/** Shared by quote and create. Validates shop, file ownership, page selection and computes the price on the server. */
export async function resolveOrderInput(user, input, { requireUnclaimed }) {
  const shop = await Shop.findOne({ _id: input.shopId, approvalStatus: 'APPROVED' });
  if (!shop) throw ApiError.notFound('Shop not found');

  const file = await filesCollection().findOne({ _id: toObjectId(input.fileId), 'metadata.owner': user._id });
  if (!file) throw ApiError.notFound('Uploaded file not found. Please upload your PDF again.');
  if (requireUnclaimed && file.metadata.claimed) throw ApiError.conflict('This file is already attached to an order.', undefined, 'FILE_ALREADY_USED');

  const selection = resolveSelection(input.pageSelection, file.metadata.pageCount);
  const price = computePrice({
    shop, printType: input.printType, selectedPages: selection.selectedPages, copies: input.copies, binding: input.binding,
  });
  return { shop, file, selection, price };
}

export async function createOrder(user, input) {
  const { shop, file, selection, price } = await resolveOrderInput(user, input, { requireUnclaimed: true });

  if (!shop.acceptingOrders) throw ApiError.conflict('This shop is not accepting new orders right now.', undefined, 'SHOP_NOT_ACCEPTING');

  // Claim the file atomically so it can only ever belong to one order.
  const claim = await filesCollection().updateOne(
    { _id: file._id, 'metadata.owner': user._id, 'metadata.claimed': false },
    { $set: { 'metadata.claimed': true } }
  );
  if (claim.modifiedCount !== 1) throw ApiError.conflict('This file is already attached to an order.', undefined, 'FILE_ALREADY_USED');

  let order;
  try {
    order = await Order.create({
      orderNumber: await nextOrderNumber(),
      customer: user._id,
      shop: shop._id,
      file: { fileId: file._id, filename: file.metadata.originalName, size: file.metadata.size, pageCount: file.metadata.pageCount },
      config: {
        printType: input.printType,
        copies: input.copies,
        pageSelection: { mode: selection.mode, ranges: selection.ranges, selectedPages: selection.selectedPages },
        sides: input.sides,
        paperSize: 'A4',
        binding: input.binding,
      },
      pricing: {
        printRatePaise: price.printRatePaise,
        bindingFeePaise: price.bindingFeePaise,
        selectedPages: price.selectedPages,
        copies: price.copies,
        printingTotalPaise: price.printingTotalPaise,
        bindingTotalPaise: price.bindingTotalPaise,
      },
      totalPaise: price.totalPaise,
      paymentPreference: input.paymentPreference,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    });
  } catch (err) {
    await filesCollection().updateOne({ _id: file._id }, { $set: { 'metadata.claimed': false } });
    throw err;
  }

  await filesCollection().updateOne({ _id: file._id }, { $set: { 'metadata.orderId': order._id } });
  await record(order, null, 'PENDING', user, 'Order placed');

  await notify({
    recipient: shop.owner, shop: shop._id, order: order._id, type: 'ORDER_RECEIVED',
    title: 'New print request', message: `${order.orderNumber} - ${order.config.pageSelection.selectedPages} pages x ${order.config.copies} copies.`,
  });
  broadcastOrderUpdate(order, shop.owner);
  return order;
}

export async function customerCancel(user, orderId) {
  const order = await Order.findOne({ _id: orderId, customer: user._id });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'PENDING') {
    throw ApiError.conflict('Only orders the shop has not accepted yet can be cancelled. Please contact the shop.', undefined, 'CANNOT_CANCEL');
  }
  const updated = await applyTransition(order, 'CANCELLED', user, {
    set: { cancellationReason: 'Cancelled by customer', cancelledByRole: 'customer' }, note: 'Cancelled by customer',
  });
  const shop = await Shop.findById(order.shop).select('owner');
  await notify({ recipient: shop.owner, shop: shop._id, order: order._id, type: 'ORDER_CANCELLED', title: 'Order cancelled', message: `${order.orderNumber} was cancelled by the customer.` });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

/* ------------------------- shop: processing ---------------------- */

export async function acceptOrder(shop, actor, orderId) {
  const order = await loadShopOrder(shop._id, orderId);
  assertTransition(order.status, 'ACCEPTED');

  // Atomic, gap-tolerant sequence allocation. Sequence reflects the time the shop accepts, not submission time.
  const bumped = await Shop.findOneAndUpdate({ _id: shop._id }, { $inc: { nextQueueSeq: 1 } }, { new: true, projection: { nextQueueSeq: 1 } });
  const queueSequence = bumped.nextQueueSeq - 1;

  const updated = await applyTransition(order, 'ACCEPTED', actor, { set: { acceptedAt: new Date(), queueSequence }, note: 'Accepted by shop' });
  await notify({
    recipient: order.customer, shop: shop._id, order: order._id, type: 'ORDER_ACCEPTED',
    title: 'Order accepted', message: `${order.orderNumber} was accepted and added to the print queue.`,
  });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

export async function rejectOrder(shop, actor, orderId, reason) {
  const order = await loadShopOrder(shop._id, orderId);
  const updated = await applyTransition(order, 'REJECTED', actor, { set: { rejectionReason: reason }, note: reason });
  await notify({ recipient: order.customer, shop: shop._id, order: order._id, type: 'ORDER_REJECTED', title: 'Order rejected', message: `${order.orderNumber} was rejected: ${reason}` });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

export async function cancelAccepted(shop, actor, orderId, reason) {
  const order = await loadShopOrder(shop._id, orderId);
  if (order.status !== 'ACCEPTED') {
    throw ApiError.conflict('Only accepted orders that have not started printing can be cancelled.', undefined, 'CANNOT_CANCEL');
  }
  const updated = await applyTransition(order, 'CANCELLED', actor, {
    set: { cancellationReason: reason, cancelledByRole: 'shop_owner' }, note: reason,
  });
  await notify({ recipient: order.customer, shop: shop._id, order: order._id, type: 'ORDER_CANCELLED', title: 'Order cancelled', message: `${order.orderNumber} was cancelled by the shop: ${reason}` });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

export async function startPrinting(shop, actor, orderId) {
  const order = await loadShopOrder(shop._id, orderId);
  assertTransition(order.status, 'PRINTING');

  // Strict FIFO: nothing accepted earlier may still be waiting or printing.
  const earlier = await Order.find({
    shop: shop._id, status: { $in: ACTIVE_QUEUE_STATUSES }, queueSequence: { $lt: order.queueSequence },
  }).select('status orderNumber').lean();
  if (earlier.some((o) => o.status === 'PRINTING')) {
    throw ApiError.conflict('Another order is being printed. Mark it ready first.', undefined, 'ALREADY_PRINTING');
  }
  if (earlier.length > 0) {
    throw ApiError.conflict(`Orders are printed first-come, first-served. Start ${earlier[0].orderNumber} first.`, undefined, 'FIFO_VIOLATION');
  }
  // A later-sequence order can't be PRINTING (FIFO), but the partial unique index also guarantees it.
  const updated = await applyTransition(order, 'PRINTING', actor, { set: { printingStartedAt: new Date() }, note: 'Printing started' });
  await notify({ recipient: order.customer, shop: shop._id, order: order._id, type: 'ORDER_PRINTING', title: 'Printing started', message: `${order.orderNumber} is being printed now.` });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

export async function markReady(shop, actor, orderId) {
  const order = await loadShopOrder(shop._id, orderId);
  const nonce = newNonce();
  const token = deriveToken(order._id, nonce);
  const updated = await applyTransition(order, 'READY_FOR_PICKUP', actor, {
    set: { readyAt: new Date(), pickup: { nonce, tokenHash: hashToken(token), usedAt: null } }, note: 'Ready for pickup',
  });
  await notify({
    recipient: order.customer, shop: shop._id, order: order._id, type: 'ORDER_READY',
    title: 'Ready for pickup', message: `${order.orderNumber} is ready. Show your pickup QR code at the shop.${order.paymentStatus === 'UNPAID' ? ' Payment is due at the counter.' : ''}`,
  });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

export async function confirmPayment(shop, actor, orderId, upiReference) {
  const order = await loadShopOrder(shop._id, orderId);
  if (!['ACCEPTED', 'PRINTING', 'READY_FOR_PICKUP'].includes(order.status)) {
    throw ApiError.conflict('Payment can only be confirmed for accepted orders that have not been collected.', undefined, 'INVALID_PAYMENT_STATE');
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'UNPAID', status: order.status },
    { $set: { paymentStatus: 'PAID', 'payment.confirmedAt': new Date(), 'payment.confirmedBy': actor._id, ...(upiReference ? { 'payment.upiReference': upiReference } : {}) } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Payment was already confirmed or the order changed. Refresh and try again.', undefined, 'STALE_ORDER');
  await record(updated, updated.status, updated.status, actor, `Payment confirmed${upiReference ? ` (UPI ref ${upiReference})` : ''}`);
  await notify({ recipient: order.customer, shop: shop._id, order: order._id, type: 'PAYMENT_CONFIRMED', title: 'Payment received', message: `The shop confirmed your payment for ${order.orderNumber}.` });
  broadcastOrderUpdate(updated, shop.owner);
  return updated;
}

/**
 * Verifies a pickup QR token (or order number + 6-digit code) for THIS shop, and optionally completes collection.
 * The token is single-use and collection requires confirmed payment.
 */
export async function verifyPickup(shop, actor, { token, orderNumber, code, collect }) {
  let order;
  const invalid = () => ApiError.notFound('Invalid pickup code for this shop');

  if (token) {
    order = await Order.findOne({ shop: shop._id, 'pickup.tokenHash': hashToken(stripPrefix(token)) });
  } else {
    order = await Order.findOne({ shop: shop._id, orderNumber: orderNumber.toUpperCase() });
    if (order && !(order.pickup?.nonce && safeEqual(deriveCode(order._id, order.pickup.nonce), code))) order = null;
  }
  if (!order) throw invalid();

  if (order.pickup?.usedAt || order.status === 'COLLECTED') {
    throw ApiError.conflict('This pickup code was already used.', undefined, 'PICKUP_ALREADY_USED');
  }
  if (order.status !== 'READY_FOR_PICKUP') {
    throw ApiError.conflict('This order is not ready for pickup.', undefined, 'NOT_READY');
  }
  if (order.paymentStatus !== 'PAID') {
    throw ApiError.conflict('Confirm payment before handing over the order.', { orderId: String(order._id) }, 'PAYMENT_REQUIRED');
  }
  if (!collect) return { order, collected: false };

  const updated = await applyTransition(order, 'COLLECTED', actor, {
    set: { collectedAt: new Date(), 'pickup.usedAt': new Date() },
    filter: { paymentStatus: 'PAID', 'pickup.usedAt': null },
    note: 'Pickup verified and collected',
  });
  await notify({ recipient: order.customer, shop: shop._id, order: order._id, type: 'ORDER_COLLECTED', title: 'Order collected', message: `${order.orderNumber} was collected. Thank you for using PrintRelay.` });
  broadcastOrderUpdate(updated, shop.owner);
  return { order: updated, collected: true };
}
