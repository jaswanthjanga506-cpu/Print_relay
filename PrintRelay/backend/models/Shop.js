import mongoose from 'mongoose';
import { SHOP_APPROVALS } from '../utils/constants.js';

const hoursSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    closed: { type: Boolean, default: false },
    open: { type: String, default: '09:00' },
    close: { type: String, default: '19:00' },
  },
  { _id: false }
);

const shopSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // one shop per owner (MVP)
    name: { type: String, required: true, trim: true, maxlength: 100 },
    address: {
      line: { type: String, required: true, trim: true, maxlength: 200 },
      locality: { type: String, required: true, trim: true, maxlength: 80 },
      city: { type: String, required: true, trim: true, maxlength: 80 },
      state: { type: String, trim: true, maxlength: 80 },
      pincode: { type: String, trim: true, maxlength: 10 },
    },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    hours: { type: [hoursSchema], default: [] },

    isOpen: { type: Boolean, default: false },
    acceptingOrders: { type: Boolean, default: false },

    approvalStatus: { type: String, enum: SHOP_APPROVALS, default: 'PENDING', index: true },
    approvalNote: { type: String, trim: true, maxlength: 300 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },

    services: {
      bw: { type: Boolean, default: true },
      colour: { type: Boolean, default: false },
      spiralBinding: { type: Boolean, default: false },
    },
    // All money is stored as integer paise.
    pricing: {
      bwPerSidePaise: { type: Number, default: 0, min: 0, validate: Number.isInteger },
      colourPerSidePaise: { type: Number, default: 0, min: 0, validate: Number.isInteger },
      spiralBindingPaise: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    },

    // Next queue sequence to hand out. Incremented atomically with $inc.
    nextQueueSeq: { type: Number, default: 1 },
  },
  { timestamps: true }
);

shopSchema.index({ approvalStatus: 1, acceptingOrders: -1, name: 1 });
shopSchema.index({ approvalStatus: 1, 'address.locality': 1 });
shopSchema.index({ approvalStatus: 1, 'address.city': 1 });

export const Shop = mongoose.model('Shop', shopSchema);
