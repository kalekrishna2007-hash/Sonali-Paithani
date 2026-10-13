import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const serverRoot = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverRoot, '..');

for (const file of ['server/.env', '.env.local', '.env']) {
  const abs = path.join(projectRoot, file);
  if (fs.existsSync(abs)) dotenv.config({ path: abs });
}

const toBool = (value, fallback = false) =>
  value === undefined ? fallback : /^(1|true|yes|on)$/i.test(String(value).trim());

const digits = (value = '') => String(value).replace(/\D+/g, '');

// Some hosts (and dev sandboxes) set PORT=0 meaning "any free port"; we want a
// predictable port so the Vite proxy and the API always agree.
const resolvePort = () => {
  const parsed = Number(process.env.PORT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4000;
};

/**
 * How many reverse proxies sit in front of Node. This is a security setting,
 * not a nicety: without it express cannot see the real client IP (so rate
 * limits collapse into one bucket) and cannot see that the customer connected
 * over https. 1 is right for Render, Railway, Fly, Heroku, Cloudflare and the
 * usual nginx setup. Set 0 when Node is exposed directly to the internet.
 */
const resolveTrustProxy = () => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw.trim() === '') return 1;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (/^(false|off|no)$/i.test(trimmed)) return false;
  if (/^(true|on|yes)$/i.test(trimmed)) return true;
  return trimmed; // express accepts "loopback", "linklocal", a CIDR list, etc.
};

const toInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: resolvePort(),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  trustProxy: resolveTrustProxy(),
  databaseUrl: (process.env.DATABASE_URL || '').trim(),

  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  adminEmail: (process.env.ADMIN_EMAIL || 'admin@sonalipaithani.com').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'paithani@123',

  store: {
    name: process.env.STORE_NAME || 'Sonali Handlooms',
    address: process.env.STORE_ADDRESS || "Sonali Handlooms, Yeola, Nashik - 423401",
    phone: process.env.STORE_PHONE || '919822055443',
    email: process.env.STORE_EMAIL || 'yeola@sonalipaithani.com',
    upi: process.env.STORE_UPI || 'sonalipaithani@upi',
    whatsapp: digits(process.env.STORE_WHATSAPP || process.env.STORE_PHONE || '919822055443'),
  },

  // Public origin used inside outbound links (the payment QR in WhatsApp).
  // Falls back to the first allowed CORS origin, i.e. the storefront itself.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),

  defaultCountryCode: digits(process.env.DEFAULT_COUNTRY_CODE || '91'),
  seedDemo: toBool(process.env.SEED_DEMO_DATA, true),

  /* Abuse controls. A live domain gets scanned and spammed within hours of
   * going up, so these are on by default and only relaxable on purpose. */
  rateLimit: {
    disabled: toBool(process.env.RATE_LIMIT_DISABLED, false),
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    enquiryMax: toInt(process.env.RATE_LIMIT_ENQUIRY_MAX, 20),
    loginMax: toInt(process.env.RATE_LIMIT_LOGIN_MAX, 10),
    lookupMax: toInt(process.env.RATE_LIMIT_LOOKUP_MAX, 60),
  },

  supabase: {
    url: (process.env.SUPABASE_URL || '').trim(),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    bucket: process.env.SUPABASE_BUCKET || 'product-images',
  },
};

export const storageMode = config.supabase.url && config.supabase.serviceRoleKey ? 'supabase' : 'local';
export const dbMode = config.databaseUrl ? 'postgres' : 'memory';

/**
 * Absolute origin for links that have to work outside this server — the
 * payment QR a customer taps from WhatsApp, and the og:image a crawler fetches.
 *
 * Order: explicit PUBLIC_BASE_URL → the host this request actually arrived on
 * (correct for a single-host deploy on any domain, https included once
 * TRUST_PROXY lets express read X-Forwarded-Proto) → the Origin header → the
 * first configured CORS origin. Only empty if none of those exist.
 */
export function publicBase(req) {
  if (config.publicBaseUrl) return config.publicBaseUrl;

  const host = typeof req?.get === 'function' ? String(req.get('host') || '').trim() : '';
  if (host) {
    const protocol = req.protocol === 'https' || req.secure ? 'https' : 'http';
    return `${protocol}://${host}`.replace(/\/+$/, '');
  }

  const origin = typeof req?.get === 'function' ? String(req.get('origin') || '').trim() : '';
  const fallback = origin || config.corsOrigin.split(',')[0] || '';
  return fallback.replace(/\/+$/, '');
}
