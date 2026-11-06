import mongoose from 'mongoose';
import {
  ORDER_STATUSES,
  PAYMENT_PREFERENCES,
  PAYMENT_STATUSES,
  PRINT_TYPES,
  SIDES,
  BINDINGS,
} from '../utils/constants.js';

const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },

    file: {
      fileId: { type: Schema.Types.ObjectId, required: true }, // GridFS id (private)
      filename: { type: String, required: true },
      size: { type: Number, required: true },
      pageCount: { type: Number, required: true },
    },

    config: {
      printType: { type: String, enum: PRINT_TYPES, required: true },
      copies: { type: Number, required: true, min: 1, max: 20 },
      pageSelection: {
        mode: { type: String, enum: ['ALL', 'RANGE'], required: true },
        ranges: { type: String }, // normalised, e.g. "1-5, 8, 10-12"
        selectedPages: { type: Number, required: true, min: 1 },
      },
      sides: { type: String, enum: SIDES, required: true },
      paperSize: { type: String, enum: ['A4'], default: 'A4' },
      binding: { type: String, enum: BINDINGS, default: 'NONE' },
    },

    // Snapshot of the price at order time. Never recalculated.
    pricing: {
      printRatePaise: { type: Number, required: true },
      bindingFeePaise: { type: Number, required: true },
      selectedPages: { type: Number, required: true },
      copies: { type: Number, required: true },
      printingTotalPaise: { type: Number, required: true },
      bindingTotalPaise: { type: Number, required: true },
    },
    totalPaise: { type: Number, required: true, min: 0 },

    status: { type: String, enum: ORDER_STATUSES, default: 'PENDING' },
    rejectionReason: { type: String, maxlength: 300 },
    cancellationReason: { type: String, maxlength: 300 },
    cancelledByRole: { type: String },

    paymentPreference: { type: String, enum: PAYMENT_PREFERENCES, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'UNPAID' },
    payment: {
      confirmedAt: Date,
      confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      upiReference: { type: String, trim: true, maxlength: 60 },
    },

    acceptedAt: Date,
    queueSequence: Number,
    printingStartedAt: Date,
    readyAt: Date,
    collectedAt: Date,

    // Secrets are derived with HMAC (see pickupService); only a hash of the token is stored.
    pickup: {
      nonce: String,
      tokenHash: String,
      usedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ customer: 1, status: 1, createdAt: -1 });
orderSchema.index({ shop: 1, status: 1, queueSequence: 1 });
orderSchema.index({ shop: 1, status: 1, createdAt: 1 });
orderSchema.index({ shop: 1, createdAt: -1 });
orderSchema.index({ 'file.fileId': 1 });
orderSchema.index({ 'pickup.tokenHash': 1 }, { sparse: true });
// Queue sequence numbers can never repeat within a shop.
orderSchema.index(
  { shop: 1, queueSequence: 1 },
  { unique: true, partialFilterExpression: { queueSequence: { $type: 'number' } }, name: 'unique_queue_seq_per_shop' }
);
// At most one PRINTING order per shop, enforced by the database.
orderSchema.index(
  { shop: 1 },
  { unique: true, partialFilterExpression: { status: 'PRINTING' }, name: 'one_printing_per_shop' }
);

export const Order = mongoose.model('Order', orderSchema);
