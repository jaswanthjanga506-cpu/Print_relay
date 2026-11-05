import { filesCollection, getBucket, toObjectId } from '../config/gridfs.js';
import { Shop } from '../models/Shop.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cleanFilename, inspectPdf, storePdf } from '../services/pdfService.js';

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose a PDF to upload.', undefined, 'NO_FILE');
  const { pageCount } = await inspectPdf(req.file.buffer);
  const originalName = cleanFilename(req.file.originalname);
  const fileId = await storePdf({ buffer: req.file.buffer, ownerId: req.user._id, originalName, pageCount });
  res.status(201).json({ data: { id: String(fileId), filename: originalName, size: req.file.size, pageCount } });
});

/** Private streaming endpoint: the uploading customer, or the shop that received an order with this file. */
export const downloadFile = asyncHandler(async (req, res) => {
  const file = await filesCollection().findOne({ _id: toObjectId(req.params.fileId) });
  let allowed = false;
  if (file) {
    if (req.user.role === 'customer') {
      allowed = String(file.metadata?.owner) === String(req.user._id);
    } else if (req.user.role === 'shop_owner') {
      const shop = await Shop.findOne({ owner: req.user._id }).select('_id');
      allowed = !!shop && !!(await Order.exists({ 'file.fileId': file._id, shop: shop._id }));
    }
  }
  if (!allowed) throw ApiError.notFound('File not found'); // same response whether it exists or not

  const name = file.metadata.originalName || 'document.pdf';
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(file.length),
    'Content-Disposition': `${disposition}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  const stream = getBucket().openDownloadStream(file._id);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});
