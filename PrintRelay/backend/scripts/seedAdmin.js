// Creates (or updates the password of) the single platform admin from environment variables.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';

const { ADMIN_NAME = 'Platform Admin', ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment (.env).');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

await connectDB();
const email = ADMIN_EMAIL.trim().toLowerCase();
const existing = await User.findOne({ email });
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

if (existing && existing.role !== 'admin') {
  console.error(`A non-admin account already uses ${email}. Choose a different ADMIN_EMAIL.`);
  process.exit(1);
}
if (existing) {
  existing.passwordHash = passwordHash;
  existing.name = ADMIN_NAME;
  await existing.save();
  console.log(`Updated admin account ${email}`);
} else {
  await User.create({ name: ADMIN_NAME, email, passwordHash, role: 'admin' });
  console.log(`Created admin account ${email}`);
}
await mongoose.connection.close();
