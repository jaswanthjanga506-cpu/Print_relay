import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './sockets/index.js';
import { startFileCleanup } from './services/fileCleanup.js';
import { User } from './models/User.js';
import { Shop } from './models/Shop.js';
import { Order } from './models/Order.js';
import { OrderEvent } from './models/OrderEvent.js';
import { Notification } from './models/Notification.js';
import { Counter } from './models/Counter.js';

async function main() {
  await connectDB();
  // Make sure all indexes (including the unique partial queue indexes) exist before serving traffic.
  await Promise.all([User, Shop, Order, OrderEvent, Notification, Counter].map((m) => m.init()));

  const server = http.createServer(createApp());
  initSocket(server);
  startFileCleanup();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.port, resolve);
  });
  console.log(`[server] PrintRelay API listening on :${env.port}`);

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  const code = err?.code ? ` (${err.code})` : '';
  console.error(`[server] failed to start${code}:`, err.message);
  if (err?.code === 'EADDRINUSE') {
    console.error(`[server] Port ${env.port} is already in use. Stop the other backend process or set PORT to a free port.`);
  } else if (/SSL routines|TLS alert|TLS handshake|Connection pool/i.test(err?.message || '')) {
    console.error('[server] MongoDB TLS failed before authentication. Check Atlas Network Access for this machine and any outbound TLS-inspecting firewall or proxy.');
  }
  process.exit(1);
});
