import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getBucket } from '../config/gridfs.js';

const bad = (msg, code = 'INVALID_PDF') => ApiError.unprocessable(msg, undefined, code);

/** Verifies the PDF signature, parses the document and returns its page count. Never trusts extension or MIME type. */
export async function inspectPdf(buffer) {
  if (!buffer || buffer.length < 8) throw bad('The file is empty or too small to be a PDF.');
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw bad('This file is not a valid PDF.');
  let pageCount;
  try {
    const doc = await PDFDocument.load(buffer, { updateMetadata: false, throwOnInvalidObject: true });
    pageCount = doc.getPageCount(); // can throw on structurally broken files, so keep it inside the try
  } catch (err) {
    if (/encrypt/i.test(err?.message || '') || err?.name === 'EncryptedPDFError') {
      throw bad('Password-protected PDFs are not supported. Remove the password and try again.', 'ENCRYPTED_PDF');
    }
    throw bad('This PDF is corrupted or could not be read.');
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) throw bad('This PDF has no pages.');
  if (pageCount > env.maxPdfPages) throw bad(`This PDF has ${pageCount} pages. The limit is ${env.maxPdfPages}.`, 'TOO_MANY_PAGES');
  return { pageCount };
}

export function cleanFilename(name) {
  // multer decodes multipart filenames as latin1; restore UTF-8
  let decoded = name || 'document.pdf';
  try { decoded = Buffer.from(decoded, 'latin1').toString('utf8'); } catch { /* keep as is */ }
  const base = path.basename(decoded.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
  const safe = (base || 'document.pdf').slice(0, 120);
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
}

export function storePdf({ buffer, ownerId, originalName, pageCount }) {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(`${crypto.randomUUID()}.pdf`, {
      contentType: 'application/pdf',
      metadata: { owner: ownerId, originalName, size: buffer.length, pageCount, claimed: false, orderId: null },
    });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id));
    stream.end(buffer);
  });
}
