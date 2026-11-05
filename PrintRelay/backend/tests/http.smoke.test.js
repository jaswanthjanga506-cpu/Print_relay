// Smoke tests that do not need MongoDB: routing, security headers, CSRF header, validation, auth guards.
process.env.NODE_ENV = 'test';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../app.js';
import { errorHandler } from '../middleware/error.js';

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

test('local Vite fallback port is allowed by development CORS', async () => {
  const allowed = await req('/health', { headers: { Origin: 'http://localhost:5174' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5174');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const denied = await req('/health', { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('readiness reports an unavailable database', async () => {
  const r = await req('/ready');
  assert.equal(r.status, 503);
  assert.deepEqual((await r.json()).data, {
    status: 'unavailable',
    service: 'printrelay-api',
    dependency: 'mongodb',
  });
});

test('database selection failures return an actionable 503', () => {
  let status;
  let body;
  const res = {
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
  };
  errorHandler(
    Object.assign(new Error('internal connection details'), { name: 'MongooseServerSelectionError' }),
    { method: 'POST', originalUrl: '/api/auth/login' },
    res,
    () => {}
  );
  assert.equal(status, 503);
  assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
  assert.match(body.error.message, /MongoDB Atlas/);
  assert.doesNotMatch(JSON.stringify(body), /internal connection details/);
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
