import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { closeDb, initDb } from '../db.js';
import { ensureAdminUser } from '../auth.js';
import { ensureCollections, ensureContent, seedDemoData } from '../seed.js';
import { createApp } from '../app.js';
import { createLimiter, resetLimiters } from '../services/ratelimit.js';
import { projectRoot } from '../env.js';

/**
 * Everything a domain host depends on: crawler files, per-domain preview tags,
 * security headers, the password-rotation path and the abuse controls.
 *
 * Node's test runner gives each file its own process, so the admin password
 * edits here never leak into api.test.js.
 */
let server;
let base;
let token;

const hasBuild = fs.existsSync(path.join(projectRoot, 'dist', 'index.html'));

const api = (pathname, options = {}) =>
  fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });

const json = async (pathname, options = {}) =>
  api(pathname, options).then(async (res) => ({ status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) }));

const signIn = (email, password) =>
  json('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });

before(async () => {
  await initDb();
  await ensureAdminUser();
  await ensureCollections();
  await seedDemoData();
  await ensureContent();
  resetLimiters();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const signedIn = await signIn('admin@sonalipaithani.com', 'paithani@123');
  token = signedIn.body.token;
  assert.ok(token, 'test setup could not sign in');
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
});

/* ── Crawler surface ───────────────────────────────────────────────────────── */

test('robots.txt points crawlers at the sitemap and keeps them out of admin', async () => {
  const res = await api('/robots.txt');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/plain/);
  const body = await res.text();
  assert.match(body, /User-agent: \*/);
  assert.match(body, /Disallow: \/admin/);
  assert.match(body, /Disallow: \/api\//);
  assert.match(body, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
});

test('sitemap.xml lists the static pages and every live product on this host', async () => {
  const res = await api('/sitemap.xml');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /xml/);
  const body = await res.text();

  assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const page of ['/', '/shop', '/legacy', '/exhibitions']) {
    assert.ok(body.includes(`<loc>${base}${page}</loc>`), `sitemap is missing ${page}`);
  }

  const products = await json('/api/products?limit=1');
  const slug = products.body.rows[0].slug;
  assert.ok(body.includes(`/shop/${slug}</loc>`), 'sitemap is missing the catalogue');
});

/* ── Per-domain preview tags ──────────────────────────────────────────────── */

test('the SPA shell resolves social tags against the host it was served from', { skip: !hasBuild && 'run `npm run build` first' }, async () => {
  const res = await api('/');
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.ok(!html.includes('__PUBLIC_BASE_URL__'), 'placeholder was left unreplaced');
  assert.match(html, new RegExp(`<link rel="canonical" href="${base}/"`));
  assert.match(html, new RegExp(`<meta property="og:image" content="${base}/images/hero-loom\\.jpg"`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${base}/"`));
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /"@type": "Store"/);
});

test('the admin SPA route is served without leaking the placeholder either', { skip: !hasBuild && 'run `npm run build` first' }, async () => {
  const html = await (await api('/admin')).text();
  assert.ok(html.includes('<div id="root">'));
  assert.ok(!html.includes('__PUBLIC_BASE_URL__'));
});

/* ── Hardening headers ────────────────────────────────────────────────────── */

test('responses carry the hardening headers a public site needs', async () => {
  const res = await api('/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('x-powered-by'), null);
});

/* ── Password rotation ────────────────────────────────────────────────────── */

test('the dashboard can rotate its own password, and validates the input', async () => {
  const auth = { authorization: `Bearer ${token}` };
  const put = (body) => json('/api/admin/password', { method: 'POST', body: JSON.stringify(body), headers: auth });

  assert.equal((await put({ current_password: 'paithani@123', new_password: 'short' })).status, 400);
  assert.equal((await put({ current_password: 'paithani@123', new_password: 'a-long-enough-pass', confirm_password: 'different-pass' })).status, 400);
  assert.equal((await put({ current_password: 'wrong-password', new_password: 'a-long-enough-pass' })).status, 401);
  // No new password is still no new password.
  assert.equal((await put({ current_password: 'paithani@123', new_password: 'paithani@123' })).status, 400);
  assert.equal((await json('/api/admin/password', { method: 'POST', body: JSON.stringify({ current_password: 'x', new_password: 'y' }) })).status, 401);

  const changed = await put({ current_password: 'paithani@123', new_password: 'yeola-handloom-2026', confirm_password: 'yeola-handloom-2026' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.updated, true);

  // The old password stops working, the new one starts.
  assert.equal((await signIn('admin@sonalipaithani.com', 'paithani@123')).status, 401);
  const after = await signIn('admin@sonalipaithani.com', 'yeola-handloom-2026');
  assert.equal(after.status, 200);
  assert.ok(after.body.token);

  // Put it back so the rest of this file keeps working.
  const restore = await json('/api/admin/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: 'yeola-handloom-2026', new_password: 'paithani@123', confirm_password: 'paithani@123' }),
    headers: { authorization: `Bearer ${after.body.token}` },
  });
  assert.equal(restore.status, 200);
});

/* ── Abuse controls ───────────────────────────────────────────────────────── */

test('the limiter blocks the request after the budget is spent and then resets', async () => {
  resetLimiters();
  const limited = createLimiter({ name: 'unit', max: 2, windowMs: 60_000, message: 'slow down' });
  const call = () =>
    new Promise((resolve) => {
      const res = {
        headers: {},
        set(key, value) {
          this.headers[key.toLowerCase()] = value;
          return this;
        },
        status(code) {
          this.code = code;
          return this;
        },
        json(payload) {
          this.payload = payload;
          resolve({ status: this.code, headers: this.headers, payload });
        },
      };
      limited({ ip: '198.51.100.7', socket: {} }, res, () => resolve({ status: 200, headers: res.headers }));
    });

  assert.equal((await call()).status, 200);
  assert.equal((await call()).status, 200);
  const blocked = await call();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.payload.error, 'slow down');
  assert.ok(Number(blocked.headers['retry-after']) >= 1);

  // A different client keeps its own budget.
  const other = await new Promise((resolve) => {
    const res = { set() { return this; }, status(code) { this.code = code; return this; }, json() { resolve(this.code); } };
    limited({ ip: '198.51.100.8', socket: {} }, res, () => resolve(200));
  });
  assert.equal(other, 200);

  resetLimiters();
});

test('the admin login stops accepting guesses from one client', async () => {
  resetLimiters();
  const attacker = { 'x-forwarded-for': '203.0.113.9' };
  let last = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const res = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@sonalipaithani.com', password: `guess-${attempt}` }),
      headers: attacker,
    });
    last = res.status;
    if (last === 429) break;
  }
  assert.equal(last, 429, 'the 12th guess should be refused');

  const blocked = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@sonalipaithani.com', password: 'guess-again' }),
    headers: attacker,
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);

  // The real client is unaffected by an attacker's exhausted budget.
  resetLimiters();
  assert.equal((await signIn('admin@sonalipaithani.com', 'paithani@123')).status, 200);
});
