import { Router } from 'express';
import authRoutes from './authRoutes.js';
import publicShopRoutes from './publicShopRoutes.js';
import shopRoutes from './shopRoutes.js';
import fileRoutes from './fileRoutes.js';
import orderRoutes from './orderRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import adminRoutes from './adminRoutes.js';

const r = Router();
r.use('/auth', authRoutes);
r.use('/shops', publicShopRoutes); // public discovery (approved shops only)
r.use('/shop', shopRoutes); // shop-owner area (own shop + own orders)
r.use('/files', fileRoutes);
r.use('/orders', orderRoutes); // customer orders
r.use('/notifications', notificationRoutes);
r.use('/admin', adminRoutes);
export default r;
