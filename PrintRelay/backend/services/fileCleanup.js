import { filesCollection, getBucket } from '../config/gridfs.js';

const DAY = 24 * 60 * 60 * 1000;

/** Removes PDFs that were uploaded but never attached to an order. */
export async function cleanupOrphanFiles() {
  try {
    const stale = await filesCollection()
      .find({ 'metadata.claimed': false, uploadDate: { $lt: new Date(Date.now() - DAY) } })
      .limit(200)
      .toArray();
    for (const f of stale) await getBucket().delete(f._id).catch(() => {});
    if (stale.length) console.log(`[cleanup] removed ${stale.length} unattached upload(s)`);
  } catch (err) {
    console.error('[cleanup] failed', err.message);
  }
}

export function startFileCleanup() {
  const timer = setInterval(cleanupOrphanFiles, 60 * 60 * 1000);
  timer.unref();
  setTimeout(cleanupOrphanFiles, 30 * 1000).unref();
}
