import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { getProductionDemoConfig } = await import('../scripts/seedDemoProduction.js');

const validEnvironment = {
  NODE_ENV: 'production',
  DEMO_PRODUCTION_SEED_ENABLED: 'true',
  ADMIN_EMAIL: 'admin@printrelay.test',
  ADMIN_PASSWORD: 'a'.repeat(32),
  DEMO_CUSTOMER_EMAIL: 'customer@printrelay.test',
  DEMO_CUSTOMER_PASSWORD: 'b'.repeat(32),
  DEMO_SHOP_OWNER_EMAIL: 'owner@printrelay.test',
  DEMO_SHOP_OWNER_PASSWORD: 'c'.repeat(32),
};

test('production demo seeding requires explicit production-only opt-in', () => {
  assert.throws(() => getProductionDemoConfig({ ...validEnvironment, NODE_ENV: 'development' }), /NODE_ENV=production/);
  assert.throws(() => getProductionDemoConfig({ ...validEnvironment, DEMO_PRODUCTION_SEED_ENABLED: 'false' }), /DEMO_PRODUCTION_SEED_ENABLED=true/);
});

test('production demo accounts require dedicated emails and distinct strong secrets', () => {
  assert.throws(() => getProductionDemoConfig({ ...validEnvironment, ADMIN_EMAIL: 'admin@example.com' }), /dedicated @printrelay\.test/);
  assert.throws(() => getProductionDemoConfig({ ...validEnvironment, ADMIN_PASSWORD: 'short' }), /between 32 and 72 bytes/);
  assert.throws(() => getProductionDemoConfig({ ...validEnvironment, ADMIN_PASSWORD: 'b'.repeat(32) }), /different generated password/);
  assert.equal(getProductionDemoConfig(validEnvironment).accounts.length, 3);
});
