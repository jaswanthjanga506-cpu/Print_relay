import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { notificationDTO } from '../utils/dto.js';

export const list = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query, { defaultLimit: 20 });
  const filter = { recipient: req.user._id, ...(req.query.unread ? { read: false } : {}) };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);
  res.json({ data: items.map(notificationDTO), unreadCount: unread, pagination: pageMeta(pg, total) });
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ data: { unread: await Notification.countDocuments({ recipient: req.user._id, read: false }) } });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { read: true } }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ data: notificationDTO(n) });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ recipient: req.user._id, read: false }, { $set: { read: true } });
  res.json({ data: { updated: r.modifiedCount } });
});
