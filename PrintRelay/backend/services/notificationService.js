import { Notification } from '../models/Notification.js';
import { notificationDTO } from '../utils/dto.js';
import { emitToUser } from '../sockets/index.js';

/** Stores a notification (source of truth) and pushes it over Socket.IO when the user is connected. Never throws. */
export async function notify({ recipient, shop, order, type, title, message }) {
  try {
    const doc = await Notification.create({ recipient, shop, order, type, title, message });
    emitToUser(recipient, 'notification', notificationDTO(doc));
  } catch (err) {
    console.error('[notify] failed', err.message);
  }
}

export function broadcastOrderUpdate(order, ownerId) {
  const payload = { orderId: String(order._id), status: order.status, paymentStatus: order.paymentStatus };
  emitToUser(order.customer, 'order:updated', payload);
  emitToUser(ownerId, 'order:updated', payload);
}
