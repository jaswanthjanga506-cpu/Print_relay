// End-to-end workflow against an in-memory MongoDB.
// Run with:  npm i && npm run test:integration     (downloads a MongoDB binary on first run)
process.env.NODE_ENV = 'test';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PDFDocument } from 'pdf-lib';

let mongod; let server; let base;
const models = {};

class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body, extraHeaders = {}) {
    const isForm = body instanceof FormData;
    const res = await fetch(base + path, {
      method,
      headers: { 'X-Requested-With': 'PrintRelay', Cookie: this.cookie, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) this.cookie = set.map((c) => c.split(';')[0]).join('; ');
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()), headers: res.headers };
  }
}

const hours = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '20:00' }));
const shopBody = (name) => ({ name, phone: '9876543210', address: { line: '12 Main Road', locality: 'Madhapur', city: 'Hyderabad' }, hours });
const pdfForm = async (pages, filename = 'notes.pdf') => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage();
  const fd = new FormData();
  fd.append('file', new Blob([await doc.save()], { type: 'application/pdf' }), filename);
  return fd;
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('printrelay_test');
  const { connectDB } = await import('../../config/db.js');
  await connectDB();
  models.User = (await import('../../models/User.js')).User;
  models.Order = (await import('../../models/Order.js')).Order;
  for (const m of ['User', 'Shop', 'Order', 'OrderEvent', 'Notification', 'Counter']) {
    await (await import(`../../models/${m}.js`))[m].init();
  }
  const { createApp } = await import('../../app.js');
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server?.close(); await mongoose.disconnect(); await mongod?.stop(); });

test('full customer -> shop -> pickup workflow', async () => {
  const [c1, c2, ownerA, ownerB, admin] = [new Client(), new Client(), new Client(), new Client(), new Client()];

  // registration + login
  for (const [c, n] of [[c1, 'one'], [c2, 'two']]) {
    const r = await c.call('POST', '/auth/register/customer', { name: `Cust ${n}`, email: `${n}@example.com`, password: 'Passw0rdX' });
    assert.equal(r.status, 201);
  }
  assert.equal((await c1.call('GET', '/auth/me')).body.data.user.email, 'one@example.com');
  assert.equal((await new Client().call('POST', '/auth/login', { email: 'one@example.com', password: 'wrongpass1' })).status, 401);

  // shops + admin approval
  const rA = await ownerA.call('POST', '/auth/register/shop-owner', { name: 'Owner A', email: 'a@example.com', password: 'Passw0rdX', phone: '9876543210', shop: shopBody('Alpha Prints') });
  const rB = await ownerB.call('POST', '/auth/register/shop-owner', { name: 'Owner B', email: 'b@example.com', password: 'Passw0rdX', phone: '9876543211', shop: shopBody('Beta Prints') });
  assert.equal(rA.status, 201); assert.equal(rB.status, 201);
  await models.User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('AdminPass12345', 4), role: 'admin' });
  assert.equal((await admin.call('POST', '/auth/login', { email: 'admin@example.com', password: 'AdminPass12345' })).status, 200);
  assert.equal((await c1.call('GET', '/admin/dashboard')).status, 403);
  assert.equal((await c1.call('GET', '/shops')).body.data.length, 0); // nothing approved yet

  const shops = (await admin.call('GET', '/admin/shops')).body.data;
  const shopA = shops.find((s) => s.name === 'Alpha Prints'); const shopB = shops.find((s) => s.name === 'Beta Prints');
  assert.equal((await ownerA.call('PATCH', '/shop/me/availability', { acceptingOrders: true })).status, 403); // not approved yet
  for (const s of [shopA, shopB]) assert.equal((await admin.call('PATCH', `/admin/shops/${s.id}/status`, { status: 'APPROVED' })).status, 200);

  assert.equal((await ownerA.call('PATCH', '/shop/me/offerings', { services: { bw: true, colour: true, spiralBinding: true }, pricing: { bwPerSidePaise: 200, colourPerSidePaise: 1000, spiralBindingPaise: 3000 } })).status, 200);
  assert.equal((await ownerA.call('PATCH', '/shop/me/availability', { isOpen: true, acceptingOrders: true })).status, 200);
  const listed = (await c1.call('GET', '/shops?q=alpha&service=colour&accepting=true')).body.data;
  assert.equal(listed.length, 1);

  // uploads
  assert.equal((await c1.call('POST', '/files', await pdfForm(1, 'fake.pdf').then(() => { const fd = new FormData(); fd.append('file', new Blob(['not a pdf at all'], { type: 'application/pdf' }), 'fake.pdf'); return fd; }))).status, 422);
  const up1 = await c1.call('POST', '/files', await pdfForm(10));
  const up2 = await c2.call('POST', '/files', await pdfForm(4));
  assert.equal(up1.status, 201); assert.equal(up1.body.data.pageCount, 10);

  // pricing is computed on the server
  const cfg = (fileId) => ({ shopId: shopA.id, fileId, printType: 'BW', copies: 3, pageSelection: { mode: 'RANGE', ranges: '1-5, 8' }, sides: 'DOUBLE', binding: 'SPIRAL', paymentPreference: 'CASH' });
  assert.equal((await c1.call('POST', '/orders', { ...cfg(up1.body.data.id), pageSelection: { mode: 'RANGE', ranges: '1-5, 5' } })).status, 422);
  const o1 = await c1.call('POST', '/orders', cfg(up1.body.data.id));
  assert.equal(o1.status, 201);
  assert.equal(o1.body.data.totalPaise, 6 * 3 * 200 + 3 * 3000);
  assert.match(o1.body.data.orderNumber, /^PR-\d{4}-000001$/);
  assert.equal(o1.body.data.status, 'PENDING'); assert.equal(o1.body.data.paymentStatus, 'UNPAID');
  assert.equal((await c1.call('POST', '/orders', cfg(up1.body.data.id))).status, 409); // file already used
  const o2 = await c2.call('POST', '/orders', { ...cfg(up2.body.data.id), pageSelection: { mode: 'ALL' }, binding: 'NONE', paymentPreference: 'UPI' });
  assert.equal(o2.status, 201);

  // isolation
  assert.equal((await c2.call('GET', `/orders/${o1.body.data.id}`)).status, 404);
  assert.equal((await c2.call('GET', `/files/${up1.body.data.id}`)).status, 404);
  assert.equal((await ownerB.call('GET', `/shop/orders/${o1.body.data.id}`)).status, 404);
  assert.equal((await ownerB.call('GET', `/files/${up1.body.data.id}`)).status, 404);
  assert.equal((await ownerB.call('PATCH', `/shop/orders/${o1.body.data.id}/accept`)).status, 404);
  const dl = await ownerA.call('GET', `/files/${up1.body.data.id}?download=1`);
  assert.equal(dl.status, 200); assert.equal(dl.body.subarray(0, 5).toString(), '%PDF-');

  // FIFO queue by acceptance time: accept o2 first, then o1
  const acc2 = await ownerA.call('PATCH', `/shop/orders/${o2.body.data.id}/accept`);
  const acc1 = await ownerA.call('PATCH', `/shop/orders/${o1.body.data.id}/accept`);
  assert.equal(acc2.body.data.queueSequence, 1); assert.equal(acc1.body.data.queueSequence, 2);
  let q = (await c1.call('GET', `/orders/${o1.body.data.id}`)).body.data.queue;
  assert.deepEqual([q.position, q.ahead, q.isPrinting], [2, 1, false]);
  assert.equal((await ownerA.call('PATCH', `/shop/orders/${o1.body.data.id}/start`)).status, 409); // not first in line
  assert.equal((await ownerA.call('PATCH', `/shop/orders/${o2.body.data.id}/start`)).status, 200);
  assert.equal((await ownerA.call('PATCH', `/shop/orders/${o2.body.data.id}/cancel`, { reason: 'too late' })).status, 409);

  // ready -> queue shifts
  assert.equal((await ownerA.call('PATCH', `/shop/orders/${o2.body.data.id}/ready`)).status, 200);
  q = (await c1.call('GET', `/orders/${o1.body.data.id}`)).body.data.queue;
  assert.deepEqual([q.position, q.ahead], [1, 0]);

  // pickup: unpaid orders can't be collected, tokens are single use
  const pk = await c2.call('GET', `/orders/${o2.body.data.id}/pickup`);
  assert.equal(pk.status, 200); assert.match(pk.body.data.manualCode, /^\d{6}$/);
  assert.match(pk.body.data.qrDataUrl, /^data:image\/png;base64,/);
  const unpaid = await ownerA.call('POST', '/shop/orders/verify-pickup', { orderNumber: o2.body.data.orderNumber, code: pk.body.data.manualCode });
  assert.equal(unpaid.status, 409); assert.equal(unpaid.body.error.code, 'PAYMENT_REQUIRED');
  assert.equal((await ownerB.call('POST', '/shop/orders/verify-pickup', { orderNumber: o2.body.data.orderNumber, code: pk.body.data.manualCode })).status, 404);
  assert.equal((await ownerA.call('POST', '/shop/orders/verify-pickup', { orderNumber: o2.body.data.orderNumber, code: '000000' })).status, 404);
  assert.equal((await ownerA.call('PATCH', `/shop/orders/${o2.body.data.id}/payment`, { upiReference: 'UPI123456' })).status, 200);
  assert.equal((await ownerA.call('PATCH', `/shop/orders/${o2.body.data.id}/payment`, {})).status, 409); // already paid
  const done = await ownerA.call('POST', '/shop/orders/verify-pickup', { orderNumber: o2.body.data.orderNumber, code: pk.body.data.manualCode });
  assert.equal(done.status, 200); assert.equal(done.body.data.order.status, 'COLLECTED');
  const again = await ownerA.call('POST', '/shop/orders/verify-pickup', { orderNumber: o2.body.data.orderNumber, code: pk.body.data.manualCode });
  assert.equal(again.status, 409); assert.equal(again.body.error.code, 'PICKUP_ALREADY_USED');
  assert.equal((await c2.call('GET', `/orders/${o2.body.data.id}/pickup`)).status, 409);

  // notifications persisted
  const notes = (await c2.call('GET', '/notifications')).body;
  assert.ok(notes.data.some((n) => n.type === 'ORDER_COLLECTED'));
  assert.ok(notes.unreadCount > 0);
});

test('only one PRINTING order per shop is enforced by the database', async () => {
  const { Order } = models;
  const dupe = await Order.collection.indexes();
  assert.ok(dupe.some((i) => i.name === 'one_printing_per_shop' && i.unique));
  assert.ok(dupe.some((i) => i.name === 'unique_queue_seq_per_shop' && i.unique));
});
