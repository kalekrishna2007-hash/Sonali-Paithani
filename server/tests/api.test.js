import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { closeDb, initDb } from '../db.js';
import { ensureAdminUser } from '../auth.js';
import { ensureCollections, seedDemoData } from '../seed.js';
import { createApp } from '../app.js';
import { dbMode } from '../env.js';

let server;
let base;
let token;

const api = (path, options = {}) =>
  fetch(`${base}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));

before(async () => {
  await initDb();
  await ensureAdminUser();
  await ensureCollections();
  await seedDemoData();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
});

test('runs against the in-memory database unless DATABASE_URL is set', () => {
  assert.equal(dbMode, 'memory', 'tests expect the in-memory engine');
});

test('storefront exposes collections and products', async () => {
  const collections = await api('/api/collections');
  assert.equal(collections.status, 200);
  assert.ok(collections.body.collections.length >= 4);
  assert.ok(collections.body.collections[0].product_count >= 0);

  const products = await api('/api/products?limit=3');
  assert.equal(products.status, 200);
  assert.equal(products.body.rows.length, 3);
  assert.ok(products.body.total >= 8);
});

test('storefront exposes the Our Legacy and Exhibitions sections', async () => {
  const legacy = await api('/api/legacy');
  assert.equal(legacy.status, 200);
  assert.ok(legacy.body.legacy.length >= 1);
  assert.ok(legacy.body.legacy[0].celebrity_name);

  const exhibitions = await api('/api/exhibitions');
  assert.equal(exhibitions.status, 200);
  assert.ok(exhibitions.body.exhibitions.length >= 1);
  assert.ok(Array.isArray(exhibitions.body.exhibitions[0].images));
});

test('product detail 404s for an unknown slug', async () => {
  const res = await api('/api/products/not-a-real-saree');
  assert.equal(res.status, 404);
});

test('admin routes reject unauthenticated requests', async () => {
  const res = await api('/api/admin/enquiries');
  assert.equal(res.status, 401);
});

test('admin can sign in with the seeded credentials', async () => {
  const res = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@sonalipaithani.com', password: 'paithani@123' }),
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  token = res.body.token;
});

test('a customer enquiry reaches the admin dashboard', async () => {
  const catalogue = await api('/api/products?limit=1');
  const product = catalogue.body.rows[0];

  const created = await api('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({
      customer_name: 'Rutuja Deshmukh',
      phone: '98220 55443',
      city: 'Pune',
      customer_note: 'Needed before Diwali',
      items: [{ product_id: product.id, quantity: 1, size: '6.3 M with Blouse', color: 'Maroon' }],
    }),
  });
  assert.equal(created.status, 201);
  assert.match(created.body.enquiry.reference, /^SP-\d{4}-\d{4}$/);
  assert.equal(created.body.enquiry.status, 'pending');
  assert.equal(created.body.enquiry.item_count, 1);

  const list = await api('/api/admin/enquiries?status=pending');
  assert.equal(list.status, 200);
  const row = list.body.rows.find((item) => item.reference === created.body.enquiry.reference);
  assert.ok(row);
  assert.ok(list.body.counts.pending >= 1);
  // The dashboard list names the saree, so no enquiry reads as a generic request.
  assert.equal(row.items[0].product_name, product.name);
  assert.equal(row.items[0].quantity, 1);

  globalThis.__enquiryReference = created.body.enquiry.reference;
});

test('rejects an enquiry with no items or a broken phone number', async () => {
  const noItems = await api('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({ customer_name: 'Test', phone: '9822055443', items: [] }),
  });
  assert.equal(noItems.status, 400);
  assert.match(noItems.body.error, /specific saree/i);

  // A line that does not name a saree is not a valid enquiry either.
  const namelessItem = await api('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({ customer_name: 'Test', phone: '9822055443', items: [{ quantity: 1 }] }),
  });
  assert.equal(namelessItem.status, 400);
  assert.match(namelessItem.body.error, /name the saree/i);

  const badPhone = await api('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({ customer_name: 'Test', phone: '12', items: [{ product_id: 'x' }] }),
  });
  assert.equal(badPhone.status, 400);
});

test('approving an enquiry returns a ready WhatsApp link and releases stock', async () => {
  const reference = globalThis.__enquiryReference;
  const detail = await api(`/api/admin/enquiries/${reference}`);
  assert.equal(detail.status, 200);
  const enquiry = detail.body.enquiry;
  const productId = enquiry.items[0].product_id;

  const before = await api(`/api/admin/products/${productId}`);
  const stockBefore = before.body.product.stock;

  const preview = await api(`/api/admin/enquiries/${reference}/preview`, {
    method: 'POST',
    body: JSON.stringify({ total_amount: 136000, advance_amount: 40000 }),
  });
  assert.equal(preview.status, 200);
  assert.match(preview.body.whatsapp.message, /SP-/);
  assert.match(preview.body.whatsapp.send_url, /^https:\/\/wa\.me\/919822055443\?text=/);
  assert.match(preview.body.whatsapp.message, /api\/qr\/upi\.png\?pa=/, 'the message links the payment QR');
  assert.match(preview.body.whatsapp.qr_url, /^https?:\/\/[^/]+\/api\/qr\/upi\.png\?/);

  const approved = await api(`/api/admin/enquiries/${reference}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      total_amount: 136000,
      advance_amount: 40000,
      payment_note: 'Deposit 30% to confirm.',
      deduct_stock: true,
    }),
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.enquiry.status, 'approved');
  assert.equal(Number(approved.body.enquiry.quoted_total), 136000);
  assert.match(decodeURIComponent(approved.body.whatsapp.send_url), /Total order value:\* ₹1,36,000/);
  assert.equal(approved.body.stock_changes.length, 1);
  assert.equal(approved.body.stock_changes[0].balance, stockBefore - 1);

  const after = await api(`/api/admin/products/${productId}`);
  assert.equal(after.body.product.stock, stockBefore - 1);

  const movements = await api(`/api/admin/products/${productId}/stock`);
  assert.equal(movements.status, 200);
  assert.ok(movements.body.movements.some((row) => row.reason === 'enquiry-approved'));

  const sent = await api(`/api/admin/enquiries/${reference}/sent`, {
    method: 'POST',
    body: JSON.stringify({ message: approved.body.whatsapp.message }),
  });
  assert.equal(sent.status, 200);
  assert.ok(sent.body.enquiry.whatsapp_sent_at);
  assert.equal(sent.body.enquiry.messages.length, 1);
});

test('the payment QR image is served as a PNG', async () => {
  const res = await fetch(`${base}/api/qr/upi.png?pa=sonalipaithani%40upi&pn=Sonali%20Paithani&am=20400&tn=SP-2026-0007`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/png/);
  const png = Buffer.from(await res.arrayBuffer());
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(png.length > 500, 'renders a real image, not an empty shell');
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), 'square image');

  const bad = await fetch(`${base}/api/qr/upi.png?pa=not-a-upi-id`);
  assert.equal(bad.status, 400, 'a malformed UPI id is refused');
});

test('cancelling an approved enquiry returns the stock', async () => {
  const reference = globalThis.__enquiryReference;
  const before = await api(`/api/admin/enquiries/${reference}`);
  const productId = before.body.enquiry.items[0].product_id;
  const stockBefore = (await api(`/api/admin/products/${productId}`)).body.product.stock;

  const cancelled = await api(`/api/admin/enquiries/${reference}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'cancelled', reason: 'Customer postponed' }),
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.enquiry.status, 'cancelled');

  const after = await api(`/api/admin/products/${productId}`);
  assert.equal(after.body.product.stock, stockBefore + 1);
});

test('overselling an approved order is recorded instead of hidden at zero', async () => {
  const single = (await api('/api/products?in_stock=true&limit=1')).body.rows[0];
  const created = await api('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({
      customer_name: 'Oversell Test',
      phone: '9822055443',
      items: [{ product_id: single.id, quantity: 5 }],
    }),
  });
  assert.equal(created.status, 201);
  const reference = created.body.enquiry.reference;

  const approved = await api(`/api/admin/enquiries/${reference}/approve`, {
    method: 'POST',
    body: JSON.stringify({ total_amount: 1000, advance_amount: 200, deduct_stock: true }),
  });
  assert.equal(approved.status, 200);
  const change = approved.body.stock_changes[0];
  assert.equal(change.oversold, true);
  assert.ok(change.balance < 0, 'negative balance flags the missing piece');

  const product = (await api(`/api/admin/products/${single.id}`)).body.product;
  assert.ok(product.stock < 0);
  assert.equal(product.in_stock, false, 'oversold products drop out of the in-stock filter');

  await api(`/api/admin/enquiries/${reference}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'cancelled', reason: 'test cleanup' }),
  });
});

test('manual stock updates reject negative values', async () => {
  const product = (await api('/api/products?limit=1')).body.rows[0];
  const res = await api(`/api/admin/products/${product.id}/stock`, {
    method: 'POST',
    body: JSON.stringify({ set_to: -3 }),
  });
  assert.equal(res.status, 400);
});

test('admin manages the catalogue: create, edit stock, update, delete, restore', async () => {
  const created = await api('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test Kanjivaram Paithani',
      price: 25000,
      stock: 4,
      collection_slug: 'Contemporary Paithani',
      images: ['/images/paithani-1.svg'],
      colors: ['Green', 'Green', 'Blue'],
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.product.slug, 'test-kanjivaram-paithani');
  assert.deepEqual(created.body.product.colors, ['Green', 'Blue']);
  const id = created.body.product.id;

  const stocked = await api(`/api/admin/products/${id}/stock`, {
    method: 'POST',
    body: JSON.stringify({ set_to: 11, reason: 'stock-take' }),
  });
  assert.equal(stocked.status, 200);
  assert.equal(stocked.body.product.stock, 11);

  const updated = await api(`/api/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ price: 27000, is_featured: true }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.product.price, 27000);
  assert.equal(updated.body.product.is_featured, true);
  assert.equal(updated.body.product.stock, 11, 'stock survives an unrelated edit');

  const hidden = await api(`/api/admin/products/${id}`, { method: 'DELETE' });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.product.is_deleted, true);

  const publicLookup = await api('/api/products/test-kanjivaram-paithani');
  assert.equal(publicLookup.status, 404, 'deleted products leave the storefront');

  const restored = await api(`/api/admin/products/${id}/restore`, { method: 'POST' });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.product.is_deleted, false);

  const hard = await api(`/api/admin/products/${id}?hard=true`, { method: 'DELETE' });
  assert.equal(hard.status, 200);
});

test('storefront search and filters work', async () => {
  const search = await api('/api/products?q=bridal');
  assert.ok(search.body.rows.length >= 1);

  const inStock = await api('/api/products?in_stock=true');
  assert.ok(inStock.body.rows.every((row) => row.stock > 0));

  const sorted = await api('/api/products?sort=price-asc&limit=5');
  const prices = sorted.body.rows.map((row) => row.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('admin can read and update store settings, including the message template', async () => {
  const settings = await api('/api/admin/settings');
  assert.equal(settings.status, 200);
  assert.ok(settings.body.settings.whatsapp_template.includes('{{items}}'));

  const patch = await api('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ store_upi: 'sonali@okhdfcbank', advance_percent: '40' }),
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.settings.store_upi, 'sonali@okhdfcbank');

  const publicView = await api('/api/settings');
  assert.equal(publicView.body.store_upi, 'sonali@okhdfcbank');
  assert.equal(publicView.body.whatsapp_template, undefined, 'template stays private');
});

test('customer can check enquiry status with reference and phone', async () => {
  const reference = globalThis.__enquiryReference;
  const ok = await api(`/api/enquiries/${reference}?phone=9822055443`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.reference, reference);

  const wrongPhone = await api(`/api/enquiries/${reference}?phone=9999999999`);
  assert.equal(wrongPhone.status, 404);
});

test('admin manages legacy entries and exhibitions', async () => {
  const createdLegacy = await api('/api/admin/legacy', {
    method: 'POST',
    body: JSON.stringify({ celebrity_name: 'Test Personality', title: 'Actor', review: 'Wore the peacock munni.', image_url: '/images/paithani-1.svg' }),
  });
  assert.equal(createdLegacy.status, 201);
  const legacyId = createdLegacy.body.entry.id;
  assert.equal(createdLegacy.body.entry.is_active, true);

  // A review with no name is refused.
  const nameless = await api('/api/admin/legacy', { method: 'POST', body: JSON.stringify({ review: 'no name' }) });
  assert.equal(nameless.status, 400);

  const hidden = await api(`/api/admin/legacy/${legacyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: false, title: 'Film actor' }),
  });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.entry.is_active, false);
  assert.equal(hidden.body.entry.title, 'Film actor');

  const publicLegacy = await api('/api/legacy');
  assert.ok(!publicLegacy.body.legacy.some((row) => row.id === legacyId), 'hidden entries leave the storefront');

  const createdShow = await api('/api/admin/exhibitions', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Test Handloom Expo',
      location: 'Nashik',
      event_date: 'March 2026',
      description: 'A test showcase.',
      images: ['/images/paithani-2.svg', '/images/paithani-3.svg'],
    }),
  });
  assert.equal(createdShow.status, 201);
  assert.deepEqual(createdShow.body.exhibition.images, ['/images/paithani-2.svg', '/images/paithani-3.svg']);
  const showId = createdShow.body.exhibition.id;

  const updatedShow = await api(`/api/admin/exhibitions/${showId}`, {
    method: 'PATCH',
    body: JSON.stringify({ location: 'Pune', images: ['/images/paithani-2.svg'] }),
  });
  assert.equal(updatedShow.status, 200);
  assert.equal(updatedShow.body.exhibition.location, 'Pune');
  assert.deepEqual(updatedShow.body.exhibition.images, ['/images/paithani-2.svg']);

  const publicShows = await api('/api/exhibitions');
  assert.ok(publicShows.body.exhibitions.some((row) => row.id === showId), 'a live exhibition reaches the storefront');

  assert.equal((await api(`/api/admin/legacy/${legacyId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await api(`/api/admin/exhibitions/${showId}`, { method: 'DELETE' })).status, 200);
});

test('dashboard stats summarise enquiries and stock warnings', async () => {
  const stats = await api('/api/admin/stats');
  assert.equal(stats.status, 200);
  assert.ok(stats.body.enquiries.total >= 1);
  assert.ok(stats.body.products.total >= 8);
  assert.ok(Array.isArray(stats.body.low_stock));
  assert.ok(Array.isArray(stats.body.recent));
});
