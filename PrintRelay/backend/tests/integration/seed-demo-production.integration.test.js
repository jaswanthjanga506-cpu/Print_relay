process.env.NODE_ENV = 'test';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;
let User;
let Shop;
let seedProductionDemoAccounts;
let getProductionDemoConfig;

const config = {
  NODE_ENV: 'production',
  DEMO_PRODUCTION_SEED_ENABLED: 'true',
  ADMIN_NAME: 'Demo Admin',
  ADMIN_EMAIL: 'admin@printrelay.test',
  ADMIN_PASSWORD: 'admin-secret'.padEnd(32, 'a'),
  DEMO_CUSTOMER_EMAIL: 'customer@printrelay.test',
  DEMO_CUSTOMER_PASSWORD: 'customer-secret'.padEnd(32, 'b'),
  DEMO_SHOP_OWNER_EMAIL: 'owner@printrelay.test',
  DEMO_SHOP_OWNER_PASSWORD: 'owner-secret'.padEnd(32, 'c'),
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('printrelay_seed_test');
  const [{ connectDB }, userModel, shopModel, seedModule] = await Promise.all([
    import('../../config/db.js'),
    import('../../models/User.js'),
    import('../../models/Shop.js'),
    import('../../scripts/seedDemoProduction.js'),
  ]);
  await connectDB();
  User = userModel.User;
  Shop = shopModel.Shop;
  seedProductionDemoAccounts = seedModule.seedProductionDemoAccounts;
  getProductionDemoConfig = seedModule.getProductionDemoConfig;
  await User.init();
  await Shop.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

test('production demo seeding creates accounts once and leaves existing credentials untouched', async () => {
  const seedConfig = getProductionDemoConfig(config);
  const first = await seedProductionDemoAccounts(seedConfig);

  assert.equal(first.createdAccounts.length, 3);
  assert.equal(first.createdShop, true);
  assert.equal(first.shop.isOpen, false);
  assert.equal(first.shop.acceptingOrders, false);
  assert.equal(first.shop.approvalStatus, 'APPROVED');
  assert.equal(await bcrypt.compare(config.ADMIN_PASSWORD, first.users.admin.passwordHash), true);

  const originalPasswordHash = first.users.customer.passwordHash;
  first.users.customer.status = 'SUSPENDED';
  await first.users.customer.save();
  const second = await seedProductionDemoAccounts(seedConfig);

  assert.deepEqual(second.createdAccounts, []);
  assert.equal(second.createdShop, false);
  const preservedCustomer = await User.findOne({ email: config.DEMO_CUSTOMER_EMAIL }).select('+passwordHash');
  assert.equal(preservedCustomer.passwordHash, originalPasswordHash);
  assert.equal(second.users.customer.status, 'SUSPENDED');
  assert.equal(await User.countDocuments(), 3);
  assert.equal(await Shop.countDocuments(), 1);
});

test('production demo seeding refuses accounts already assigned another role', async () => {
  const accounts = getProductionDemoConfig(config).accounts;
  const customer = accounts.find(({ key }) => key === 'customer');
  const existing = await User.findOne({ email: customer.email });
  existing.role = 'admin';
  await existing.save();

  await assert.rejects(seedProductionDemoAccounts(getProductionDemoConfig(config)), /different role/);
});
