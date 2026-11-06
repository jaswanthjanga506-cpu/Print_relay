import { z } from 'zod';
import { listQuery } from './common.js';

export const notificationQuery = listQuery.extend({ unread: z.enum(['true']).optional() });
