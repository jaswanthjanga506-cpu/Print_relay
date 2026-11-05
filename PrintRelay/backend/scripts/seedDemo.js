import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';
import { defaultHours } from '../validators/shop.validators.js';

const DEMO_ACCOUNTS = [
  {
    key: 'admin',
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    name: 'PrintRelay Demo Admin',
  },
  {
    key: 'customer',
    email: process.env.DEMO_CUSTOMER_EMAIL,
    password: process.env.DEMO_CUSTOMER_PASSWORD,
    role: 'customer',
    name: 'PrintRelay Demo Customer',
    phone: '+15550001001',
  },
  {
    key: 'shop owner',
    email: process.env.DEMO_SHOP_OWNER_EMAIL,
    password: process.env.DEMO_SHOP_OWNER_PASSWORD,
    role: 'shop_owner',
    name: 'PrintRelay Demo Shop Owner',
    phone: '+15550001002',
  },
];

function assertDemoConfiguration() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Demo seeding is permitted only when NODE_ENV=development.');
  }
  if (process.env.DEMO_SEED_ENABLED !== 'true') {
    throw new Error('Set DEMO_SEED_ENABLED=true in the local backend/.env to seed demo accounts.');
  }

  const expectedEmails = [
    'admin@printrelay.test',
    'customer@printrelay.test',
    'owner@printrelay.test',
  ];
  const configuredEmails = DEMO_ACCOUNTS.map(({ email }) => email?.trim().toLowerCase());
  if (configuredEmails.some((email, index) => email !== expectedEmails[index])) {
    throw new Error('Demo account emails must use the dedicated printrelay.test addresses.');
  }
  if (new Set(configuredEmails).size !== DEMO_ACCOUNTS.length) {
    throw new Error('Each demo account must have a unique email address.');
  }
  for (const { key, password } of DEMO_ACCOUNTS) {
    if (!password || password.length < 12 || password.length > 72) {
      throw new Error(`Configure a ${key} password between 12 and 72 characters.`);
    }
  }
}

async function seedUser(account) {
  const email = account.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing && existing.role !== account.role) {
    throw new Error(`Cannot seed ${account.key}: the dedicated email is already used by a different role.`);
  }

  const passwordHash = await bcrypt.hash(account.password, 12);
  const user = existing || new User({ email, role: account.role });
  user.name = account.name;
  user.passwordHash = passwordHash;
  user.status = 'ACTIVE';
  if (account.phone) user.phone = account.phone;
  await user.save();
  return user;
}

async function seedDemoShop(owner, admin) {
  const demoName = 'PrintRelay Demo Shop';
  const ownerShop = await Shop.findOne({ owner: owner._id });
  if (ownerShop && ownerShop.name !== demoName) {
    throw new Error('The demo owner already has a different shop; refusing to modify it.');
  }

  const namedShop = await Shop.findOne({ name: demoName });
  if (namedShop && String(namedShop.owner) !== String(owner._id)) {
    throw new Error('PrintRelay Demo Shop already belongs to a different owner; refusing to modify it.');
  }

  const shop = ownerShop || namedShop || new Shop({ owner: owner._id, name: demoName });
  Object.assign(shop, {
    name: demoName,
    address: {
      line: '100 Demo Street',
      locality: 'PrintRelay Test District',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
    },
    phone: owner.phone,
    email: owner.email,
    hours: defaultHours(),
    services: { bw: true, colour: true, spiralBinding: true },
    pricing: {
      bwPerSidePaise: 200,
      colourPerSidePaise: 1000,
      spiralBindingPaise: 3000,
    },
    approvalStatus: 'APPROVED',
    approvalNote: undefined,
    reviewedBy: admin._id,
    reviewedAt: new Date(),
    isOpen: true,
    acceptingOrders: true,
  });
  await shop.save();
  return shop;
}

async function main() {
  assertDemoConfiguration();
  await connectDB();
  const accounts = {};
  for (const account of DEMO_ACCOUNTS) {
    accounts[account.key] = await seedUser(account);
  }
  const shop = await seedDemoShop(accounts['shop owner'], accounts.admin);
  console.log(`Demo accounts ready for ${mongoose.connection.name}; demo shop "${shop.name}" is approved and accepting orders.`);
}

try {
  await main();
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
