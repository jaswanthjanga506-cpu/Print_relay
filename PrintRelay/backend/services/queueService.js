import { Order } from '../models/Order.js';
import { ACTIVE_QUEUE_STATUSES } from '../utils/constants.js';

/**
 * Real queue data from MongoDB. A pending order has no position.
 * position = (active orders at the same shop with a lower sequence) + 1
 */
export async function getQueueInfo(order) {
  if (!ACTIVE_QUEUE_STATUSES.includes(order.status) || typeof order.queueSequence !== 'number') return null;
  const ahead = await Order.countDocuments({
    shop: order.shop?._id ?? order.shop,
    status: { $in: ACTIVE_QUEUE_STATUSES },
    queueSequence: { $lt: order.queueSequence },
  });
  return { position: ahead + 1, ahead, isPrinting: order.status === 'PRINTING' };
}
