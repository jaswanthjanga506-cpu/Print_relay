import { z } from 'zod';
import { email, listQuery, phone } from './common.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM time');

export const hoursSchema = z
  .array(z.object({ day: z.number().int().min(0).max(6), closed: z.boolean(), open: time, close: time }))
  .length(7, 'Provide hours for all 7 days')
  .superRefine((hours, ctx) => {
    if (new Set(hours.map((h) => h.day)).size !== 7) ctx.addIssue({ code: 'custom', message: 'Each day must appear exactly once' });
    hours.forEach((h, i) => {
      if (!h.closed && h.open >= h.close) ctx.addIssue({ code: 'custom', path: [i, 'close'], message: 'Closing time must be after opening time' });
    });
  });

export const defaultHours = () =>
  Array.from({ length: 7 }, (_, day) => ({ day, closed: day === 0, open: '09:00', close: '19:00' }));

export const shopProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter the shop name').max(100),
  address: z.object({
    line: z.string().trim().min(3, 'Enter the street address').max(200),
    locality: z.string().trim().min(2, 'Enter the locality').max(80),
    city: z.string().trim().min(2, 'Enter the city').max(80),
    state: z.string().trim().max(80).optional(),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
  }),
  phone,
  email: email.optional(),
  hours: hoursSchema.optional(),
});

export const updateShopProfileSchema = shopProfileSchema.partial();

const paise = z.number().int('Use whole paise').min(0).max(100000);

export const offeringsSchema = z
  .object({
    services: z.object({ bw: z.boolean(), colour: z.boolean(), spiralBinding: z.boolean() }),
    pricing: z.object({ bwPerSidePaise: paise, colourPerSidePaise: paise, spiralBindingPaise: paise }),
  })
  .superRefine((v, ctx) => {
    if (!v.services.bw && !v.services.colour) ctx.addIssue({ code: 'custom', path: ['services'], message: 'Enable at least one printing service' });
    if (v.services.bw && v.pricing.bwPerSidePaise < 1) ctx.addIssue({ code: 'custom', path: ['pricing', 'bwPerSidePaise'], message: 'Set a black & white price' });
    if (v.services.colour && v.pricing.colourPerSidePaise < 1) ctx.addIssue({ code: 'custom', path: ['pricing', 'colourPerSidePaise'], message: 'Set a colour price' });
  });

export const availabilitySchema = z
  .object({ isOpen: z.boolean().optional(), acceptingOrders: z.boolean().optional() })
  .refine((v) => v.isOpen !== undefined || v.acceptingOrders !== undefined, 'Nothing to update');

export const shopListQuery = listQuery.extend({
  service: z.string().trim().max(40).optional(), // comma list of bw,colour,spiral
  accepting: z.enum(['true', 'false']).optional(),
});
