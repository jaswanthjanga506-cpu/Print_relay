import { z } from 'zod';
import { email, password, phone } from './common.js';
import { shopProfileSchema } from './shop.validators.js';

export const registerCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email,
  password,
  phone: phone.optional(),
});

export const registerShopOwnerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email,
  password,
  phone,
  shop: shopProfileSchema,
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(72) });

export const updateProfileSchema = z
  .object({ name: z.string().trim().min(2).max(80).optional(), phone: phone.optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});
