import mongoose from 'mongoose';
import { ORDER_STATUSES } from '../utils/constants.js';

const orderEventSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    previousStatus: { type: String, enum: [...ORDER_STATUSES, null], default: null },
    newStatus: { type: String, enum: ORDER_STATUSES, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedByRole: { type: String },
    note: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

orderEventSchema.index({ order: 1, createdAt: 1 });

export const OrderEvent = mongoose.model('OrderEvent', orderEventSchema);
