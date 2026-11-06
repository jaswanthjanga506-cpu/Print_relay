import mongoose from 'mongoose';

export const BUCKET_NAME = 'orderFiles';

export function getBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

export function filesCollection() {
  return mongoose.connection.db.collection(`${BUCKET_NAME}.files`);
}

export const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
