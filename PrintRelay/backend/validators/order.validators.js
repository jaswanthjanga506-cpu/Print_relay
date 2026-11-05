import { z } from 'zod';
import { objectId, listQuery } from './common.js';
import { BINDINGS, ORDER_STATUSES, PAYMENT_PREFERENCES, PRINT_TYPES, SIDES } from '../utils/constants.js';

export const createOrderSchema = z.object({
  shopId: objectId,
  fileId: objectId,
  printType: z.enum(PRINT_TYPES),
  copies: z.number().int().min(1, 'Copies must be at least 1').max(20, 'Copies can be at most 20'),
  pageSelection: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('ALL') }),
    z.object({ mode: z.literal('RANGE'), ranges: z.string().trim().min(1, 'Enter the pages to print').max(200) }),
  ]),
  sides: z.enum(SIDES),
  paperSize: z.literal('A4').default('A4'),
  binding: z.enum(BINDINGS).default('NONE'),
  paymentPreference: z.enum(PAYMENT_PREFERENCES),
});

export const quoteSchema = createOrderSchema
  .omit({ paymentPreference: true })
  .extend({ sides: z.enum(SIDES).default('SINGLE') });

export const customerOrderQuery = listQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  active: z.enum(['true']).optional(),
});

export const shopOrderQuery = listQuery.extend({
  section: z.enum(['requests', 'queue', 'ready', 'history']),
});

export const reasonSchema = z.object({ reason: z.string().trim().min(3, 'A reason is required').max(300) });

export const paymentSchema = z.object({ upiReference: z.string().trim().min(3).max(60).optional() });

export const verifyPickupSchema = z
  .object({
    token: z.string().trim().min(10).max(200).optional(),
    orderNumber: z.string().trim().max(30).optional(),
    code: z.string().trim().regex(/^\d{6}$/, 'The pickup code is 6 digits').optional(),
    collect: z.boolean().default(true),
  })
  .refine((v) => v.token || (v.orderNumber && v.code), 'Provide the QR token, or the order number and 6-digit code');

export const adminOrderQuery = listQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  shop: objectId.optional(),
});
