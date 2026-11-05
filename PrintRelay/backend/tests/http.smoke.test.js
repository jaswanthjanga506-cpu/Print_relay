// Smoke tests that do not need MongoDB: routing, security headers, CSRF header, validation, auth guards.
process.env.NODE_ENV = 'test';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../app.js';

let server; let base;
before(async () => {
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'PrintRelay' };
const req = (path, opts = {}) => fetch(base + path, opts);

test('health', async () => {
  const r = await req('/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-powered-by'), null); // helmet
});

test('state-changing requests without the custom header are blocked', async () => {
  const r = await req('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('validation errors are 400 with details', async () => {
  const r = await req('/auth/register/customer', { method: 'POST', headers: H, body: JSON.stringify({ name: 'A', email: 'nope', password: 'short' }) });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.ok(body.error.details.length >= 2);
});

test('weak shop-owner registration is rejected before touching the DB', async () => {
  const r = await req('/auth/register/shop-owner', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Owner', email: 'o@x.com', password: 'abcdefg1', phone: '9876543210', shop: { name: 'S' } }) });
  assert.equal(r.status, 400);
});

test('protected routes require auth', async () => {
  for (const [m, p] of [['GET', '/auth/me'], ['GET', '/orders'], ['GET', '/shop/me'], ['GET', '/admin/dashboard'], ['GET', '/notifications'], ['GET', '/files/65f0000000000000000000aa']]) {
    const r = await req(p, { method: m });
    assert.equal(r.status, 401, `${m} ${p}`);
  }
});

test('forged / garbage JWT cookie is rejected', async () => {
  const r = await req('/orders', { headers: { Cookie: 'pr_token=not.a.jwt' } });
  assert.equal(r.status, 401);
});

test('bad object ids and unknown routes are 404', async () => {
  assert.equal((await req('/shops/not-an-id')).status, 404);
  assert.equal((await req('/nope')).status, 404);
});

test('malformed JSON is 400', async () => {
  const r = await req('/auth/login', { method: 'POST', headers: H, body: '{bad' });
  assert.equal(r.status, 400);
});
