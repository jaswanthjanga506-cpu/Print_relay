import { Server } from 'socket.io';
import cookie from 'cookie';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { verifyToken } from '../utils/token.js';
import { COOKIE_NAME } from '../utils/constants.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
  });

  // Authenticate from the same HttpOnly cookie used by the REST API.
  io.use(async (socket, next) => {
    try {
      const token = cookie.parse(socket.request.headers.cookie || '')[COOKIE_NAME];
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('role status');
      if (!user || user.status !== 'ACTIVE') return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });
  return io;
}

export const emitToUser = (userId, event, payload) => {
  if (io && userId) io.to(`user:${String(userId)}`).emit(event, payload);
};
