import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextOrderNumber(date = new Date()) {
  const year = date.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `order-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `PR-${year}-${String(counter.seq).padStart(6, '0')}`;
}
