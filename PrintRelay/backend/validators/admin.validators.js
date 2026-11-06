import { z } from 'zod';
import { listQuery } from './common.js';
import { ROLES, SHOP_APPROVALS } from '../utils/constants.js';

export const shopStatusSchema = z
  .object({ status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']), note: z.string().trim().max(300).optional() })
  .superRefine((v, ctx) => {
    if ((v.status === 'REJECTED' || v.status === 'SUSPENDED') && !v.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'A note is required when rejecting or suspending a shop' });
    }
  });

export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });
export const adminShopQuery = listQuery.extend({ status: z.enum(SHOP_APPROVALS).optional() });
export const adminUserQuery = listQuery.extend({ role: z.enum(Object.values(ROLES)).optional() });
