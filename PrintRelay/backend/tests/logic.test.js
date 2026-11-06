process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { parsePageRanges, resolveSelection } from '../services/pageRanges.js';
import { computePrice } from '../services/pricingService.js';
import { deriveCode, deriveToken, hashToken, newNonce, stripPrefix, qrPayload } from '../services/pickupService.js';
import { assertTransition } from '../services/orderService.js';
import { inspectPdf, cleanFilename } from '../services/pdfService.js';

test('page ranges: valid input', () => {
  const r = parsePageRanges('1-5, 8, 10-12', 20);
  assert.equal(r.count, 9);
  assert.equal(r.normalized, '1-5, 8, 10-12');
});

test('page ranges: rejects bad input', () => {
  for (const bad of ['', '0', '-3', '3-1', '1-25', '1,1', '1-5,3', 'a', '1,,2', '1-', '2.5', '1 2'])
    assert.throws(() => parsePageRanges(bad, 20), { status: 422 }, `should reject "${bad}"`);
});

test('resolveSelection ALL uses page count', () => {
  assert.equal(resolveSelection({ mode: 'ALL' }, 14).selectedPages, 14);
});

const shop = {
  services: { bw: true, colour: true, spiralBinding: true },
  pricing: { bwPerSidePaise: 200, colourPerSidePaise: 1000, spiralBindingPaise: 3000 },
};

test('pricing formula matches spec (integer paise)', () => {
  const p = computePrice({ shop, printType: 'BW', selectedPages: 10, copies: 3, binding: 'SPIRAL' });
  assert.equal(p.printingTotalPaise, 10 * 3 * 200);
  assert.equal(p.bindingTotalPaise, 3 * 3000);
  assert.equal(p.totalPaise, 6000 + 9000);
  const c = computePrice({ shop, printType: 'COLOUR', selectedPages: 2, copies: 1, binding: 'NONE' });
  assert.equal(c.totalPaise, 2000);
});

test('pricing rejects unsupported services', () => {
  const s = { services: { bw: true, colour: false, spiralBinding: false }, pricing: shop.pricing };
  assert.throws(() => computePrice({ shop: s, printType: 'COLOUR', selectedPages: 1, copies: 1, binding: 'NONE' }), { status: 422 });
  assert.throws(() => computePrice({ shop: s, printType: 'BW', selectedPages: 1, copies: 1, binding: 'SPIRAL' }), { status: 422 });
});

test('pickup token/code are deterministic, per-order and single hash', () => {
  const id = '65f0000000000000000000aa';
  const n = newNonce();
  const t = deriveToken(id, n);
  assert.equal(t, deriveToken(id, n));
  assert.notEqual(t, deriveToken('65f0000000000000000000ab', n));
  assert.match(deriveCode(id, n), /^\d{6}$/);
  assert.equal(stripPrefix(qrPayload(t)), t);
  assert.equal(hashToken(t).length, 64);
});

test('status transitions', () => {
  assertTransition('PENDING', 'ACCEPTED');
  assertTransition('ACCEPTED', 'PRINTING');
  assertTransition('PRINTING', 'READY_FOR_PICKUP');
  assertTransition('READY_FOR_PICKUP', 'COLLECTED');
  assert.throws(() => assertTransition('PENDING', 'PRINTING'), { status: 409 });
  assert.throws(() => assertTransition('PRINTING', 'CANCELLED'), { status: 409 });
  assert.throws(() => assertTransition('COLLECTED', 'READY_FOR_PICKUP'), { status: 409 });
  assert.throws(() => assertTransition('PENDING', 'COLLECTED'), { status: 409 });
});

test('pdf inspection: accepts real PDF, rejects junk and corrupt files', async () => {
  const doc = await PDFDocument.create();
  doc.addPage(); doc.addPage(); doc.addPage();
  const buf = Buffer.from(await doc.save());
  assert.equal((await inspectPdf(buf)).pageCount, 3);
  await assert.rejects(inspectPdf(Buffer.from('hello world this is not a pdf')), { status: 422 });
  await assert.rejects(inspectPdf(Buffer.from('%PDF-1.4 garbage garbage garbage')), { status: 422 });
  await assert.rejects(inspectPdf(Buffer.alloc(0)), { status: 422 });
  await assert.rejects(inspectPdf(buf.subarray(0, 40)), { status: 422 });
});

test('filename sanitising', () => {
  assert.equal(cleanFilename('../../etc/passwd'), 'passwd.pdf');
  assert.equal(cleanFilename('my "report".pdf'), 'my report.pdf');
});
