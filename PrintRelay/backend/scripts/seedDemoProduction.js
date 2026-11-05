import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDB } from '../config/db.js';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';
import { defaultHours } from '../validators/shop.validators.js';

const DEMO_SHOP_NAME = 'PrintRelay Demo Shop';
const ACCOUNT_DEFINITIONS = [
  { key: 'admin', emailKey: 'ADMIN_EMAIL', passwordKey: 'ADMIN_PASSWORD', role: 'admin', name: 'PrintRelay Demo Admin' },
  { key: 'customer', emailKey: 'DEMO_CUSTOMER_EMAIL', passwordKey: 'DEMO_CUSTOMER_PASSWORD', role: 'customer', name: 'PrintRelay Demo Customer', phone: '+15550001001' },
  { key: 'shop owner', emailKey: 'DEMO_SHOP_OWNER_EMAIL', passwordKey: 'DEMO_SHOP_OWNER_PASSWORD', role: 'shop_owner', name: 'PrintRelay Demo Shop Owner', phone: '+15550001002' },
];
const EXPECTED_EMAILS = ['admin@printrelay.test', 'customer@printrelay.test', 'owner@printrelay.test'];

export function getProductionDemoConfig(environment = process.env) {
  if (environment.NODE_ENV !== 'production') {
    throw new Error('Production demo seeding requires NODE_ENV=production.');
  }
  if (environment.DEMO_PRODUCTION_SEED_ENABLED !== 'true') {
    throw new Error('Set DEMO_PRODUCTION_SEED_ENABLED=true for this one-time Render Shell command.');
  }

  const accounts = ACCOUNT_DEFINITIONS.map((definition, index) => {
    const email = environment[definition.emailKey]?.trim().toLowerCase();
    const password = environment[definition.passwordKey];
    if (email !== EXPECTED_EMAILS[index]) {
      throw new Error(`${definition.emailKey} must use its dedicated @printrelay.test address.`);
    }
    if (!password || password.length < 32 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error(`${definition.passwordKey} must be a unique, generated secret between 32 and 72 bytes.`);
    }
    return { ...definition, email, password };
  });

  if (new Set(accounts.map((account) => account.password)).size !== accounts.length) {
    throw new Error('Use a different generated password for each production demo account.');
  }

  return { accounts, adminName: environment.ADMIN_NAME?.trim() || 'PrintRelay Demo Admin' };
}

export async function seedProductionDemoAccounts({ accounts, adminName }) {
  const existingUsers = await Promise.all(accounts.map(({ email }) => User.findOne({ email })));
  for (const [index, account] of accounts.entries()) {
    if (existingUsers[index] && existingUsers[index].role !== account.role) {
      throw new Error(`Cannot seed ${account.key}: its dedicated email is already used by a different role.`);
    }
  }

  const existingOwner = existingUsers[2];
  const ownerShop = existingOwner ? await Shop.findOne({ owner: existingOwner._id }) : null;
  const namedShop = await Shop.findOne({ name: DEMO_SHOP_NAME });
  if (ownerShop && ownerShop.name !== DEMO_SHOP_NAME) {
    throw new Error('The demo owner already has a different shop; refusing to modify it.');
  }
  if (namedShop && (!existingOwner || String(namedShop.owner) !== String(existingOwner._id))) {
    throw new Error('PrintRelay Demo Shop already belongs to a different owner; refusing to modify it.');
  }
  if ((ownerShop || namedShop) && ((ownerShop || namedShop).isOpen || (ownerShop || namedShop).acceptingOrders)) {
    throw new Error('The existing demo shop is accepting orders; refusing to change its production settings.');
  }

  const users = {};
  const createdAccounts = [];
  for (const [index, account] of accounts.entries()) {
    if (existingUsers[index]) {
      users[account.key] = existingUsers[index];
      continue;
    }

    users[account.key] = await User.create({
      name: account.key === 'admin' ? adminName : account.name,
      email: account.email,
      passwordHash: await bcrypt.hash(account.password, 12),
      phone: account.phone,
      role: account.role,
      status: 'ACTIVE',
    });
    createdAccounts.push(account.key);
  }

  const shop = ownerShop || namedShop || await Shop.create({
    owner: users['shop owner']._id,
    name: DEMO_SHOP_NAME,
    address: {
      line: '100 Demo Street',
      locality: 'PrintRelay Test District',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
    },
    phone: users['shop owner'].phone,
    email: users['shop owner'].email,
    hours: defaultHours(),
    services: { bw: true, colour: true, spiralBinding: true },
    pricing: { bwPerSidePaise: 200, colourPerSidePaise: 1000, spiralBindingPaise: 3000 },
    approvalStatus: 'APPROVED',
    reviewedBy: users.admin._id,
    reviewedAt: new Date(),
    isOpen: false,
    acceptingOrders: false,
  });

  return { users, shop, createdAccounts, createdShop: !ownerShop && !namedShop };
}

async function main() {
  const config = getProductionDemoConfig();
  await connectDB();
  try {
    const result = await seedProductionDemoAccounts(config);
    for (const account of config.accounts) {
      const state = result.createdAccounts.includes(account.key) ? 'created' : 'already existed';
      console.log(`[seed:demo:production] ${account.email}: ${state}`);
    }
    console.log(`[seed:demo:production] ${result.createdShop ? 'created' : 'preserved'} ${result.shop.name}; it is closed and does not accept orders.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    if (mongoose.connection.readyState) await mongoose.disconnect();
    console.error('[seed:demo:production] failed:', error.message);
    process.exitCode = 1;
  }
}
