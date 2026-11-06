import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter, requireCsrfHeader } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render / reverse proxies

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok', service: 'printrelay-api', time: new Date().toISOString() } }));
  app.get('/api/ready', async (_req, res) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ data: { status: 'unavailable', service: 'printrelay-api', dependency: 'mongodb' } });
    }

    try {
      await mongoose.connection.db.admin().ping();
      return res.json({ data: { status: 'ok', service: 'printrelay-api', time: new Date().toISOString() } });
    } catch (err) {
      console.error('[ready] MongoDB check failed', err.message);
      return res.status(503).json({ data: { status: 'unavailable', service: 'printrelay-api', dependency: 'mongodb' } });
    }
  });

  app.use('/api', apiLimiter, requireCsrfHeader, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
