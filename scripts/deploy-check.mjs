#!/usr/bin/env node
/**
 * Deployment readiness audit for Sonali Paithani.
 *
 *   npm run deploy:check
 *
 * This is the machine-checkable half of DEPLOY.md: it loads the exact same
 * configuration the API boots with (`server/env.js`, so `server/.env`,
 * `.env.local` and `process.env` all resolve identically), inspects the working
 * tree, and reports every reason the app is not yet safe to hand to customers.
 *
 * Levels: [BLOCKER] loses data, leaks access, or takes money you cannot collect.
 *         [WARN]    real risk you may consciously accept.
 *         [OK]      verified.
 * Exit code is 1 when any blocker remains, so a host or CI can gate on it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config, dbMode, storageMode, projectRoot } from '../server/env.js';

const results = [];
const add = (level, area, problem, fix) => results.push({ level, area, problem, fix });
const truthy = (value) => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
const C = (code, text) => `\u001b[${code}m${text}\u001b[0m`;

/* ── 1. Database ─────────────────────────────────────────────────────────────
   The single most damaging default: with no DATABASE_URL the API boots pg-mem
   and every enquiry lives in the process. */
if (dbMode === 'postgres') {
  add('ok', 'Database', `Postgres via DATABASE_URL (${new URL(config.databaseUrl).host})`);
} else {
  add(
    'blocker',
    'Database',
    'DATABASE_URL is empty, so the API runs on in-memory Postgres (pg-mem). Every product, enquiry, settings change and stock edit is erased the moment the process restarts or the host redeploys.',
    'Create a Postgres database (Supabase and Neon both have a free tier) and set DATABASE_URL to its connection string.',
  );
}

/* ── 2. Image storage ────────────────────────────────────────────────────────
   Local disk is fine on a VPS with a mounted volume, fatal on an ephemeral
   container filesystem. */
if (storageMode === 'supabase') {
  add('ok', 'Image storage', `Supabase Storage (bucket "${config.supabase.bucket}")`);
} else if (truthy(process.env.ALLOW_EPHEMERAL_UPLOADS)) {
  add(
    'warn',
    'Image storage',
    'Uploads are written to ./uploads on local disk. You acknowledged this with ALLOW_EPHEMERAL_UPLOADS=true — make sure that path is a persistent volume, not container disk.',
    'Drop the override once images live in object storage.',
  );
} else {
  add(
    'blocker',
    'Image storage',
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are empty, so uploads are written to ./uploads on local disk. Most hosts hand the app an ephemeral filesystem, so every saree photo you upload disappears on the next deploy.',
    'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to a Storage bucket, or set ALLOW_EPHEMERAL_UPLOADS=true if the disk really is persistent.',
  );
}

/* ── 3. JWT signing key ──────────────────────────────────────────────────── */
const secret = String(config.jwtSecret || '');
if (/insecure|change-me/i.test(secret)) {
  add(
    'blocker',
    'JWT secret',
    'JWT_SECRET is still the development placeholder. Anyone holding that string can mint a valid admin session.',
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
  );
} else if (secret.length < 32) {
  add(
    'blocker',
    'JWT secret',
    `JWT_SECRET is only ${secret.length} characters. Short signing keys are brute-forceable offline, which turns one leaked token into permanent admin access.`,
    'Replace it with at least 32 random characters (48 bytes base64url is ideal).',
  );
} else {
  add('ok', 'JWT secret', `set (${secret.length} characters)`);
}

/* ── 4. Admin password ───────────────────────────────────────────────────── */
const adminPassword = String(config.adminPassword || '');
if (adminPassword === 'paithani@123') {
  add(
    'blocker',
    'Admin password',
    'ADMIN_PASSWORD is still the shipped default, and /api/admin/login is publicly reachable.',
    'Set a strong password BEFORE the first production boot — see the rotation note below.',
  );
} else if (adminPassword.length < 12) {
  add(
    'blocker',
    'Admin password',
    `ADMIN_PASSWORD is only ${adminPassword.length} characters long.`,
    'Use at least 12 characters (a passphrase is fine).',
  );
} else {
  add('ok', 'Admin password', `set (${adminPassword.length} characters, not the default)`);
  if (adminPassword.length < 16) {
    add('warn', 'Admin password', 'Consider 16+ characters — this one password guards every customer enquiry.', 'Longer passphrase, or rotate via the dashboard.');
  }
}

/* ── 5. CORS origin ──────────────────────────────────────────────────────── */
const origins = config.corsOrigin.split(',').map((value) => value.trim()).filter(Boolean);
const localOrigins = origins.filter((origin) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(origin));
if (localOrigins.length) {
  add(
    'blocker',
    'CORS origin',
    `CORS_ORIGIN still contains ${localOrigins.join(', ')} — browsers on your real domain will be blocked from calling the API.`,
    'Set CORS_ORIGIN to the production origin, e.g. https://sonalipaithani.com (comma-separate several).',
  );
} else {
  add('ok', 'CORS origin', origins.join(', ') || '(open to any origin)');
  const insecure = origins.filter((origin) => /^http:\/\//.test(origin));
  if (insecure.length) {
    add('warn', 'CORS origin', `${insecure.join(', ')} is plain http — customers would see "not secure" and the payment QR link downgrades to http.`, 'Terminate TLS at the host and use https origins.');
  }
}

/* ── 6. Public base URL (payment-QR links) ───────────────────────────────── */
if (!config.publicBaseUrl) {
  add(
    'warn',
    'Public base URL',
    'PUBLIC_BASE_URL is unset, so payment-QR links, canonical tags and og:image URLs fall back to the host each request arrived on. That is correct for this single-host deploy — including behind https once TRUST_PROXY is right — but pin it explicitly so links stay stable if you ever add a CDN, a second domain or a separate admin host.',
    'Set PUBLIC_BASE_URL=https://your-domain once DNS is live.',
  );
} else if (!/^https:\/\//.test(config.publicBaseUrl)) {
  add('warn', 'Public base URL', `${config.publicBaseUrl} is not https — customers tapping the QR link get a browser warning.`, 'Use the https origin.');
} else {
  add('ok', 'Public base URL', config.publicBaseUrl);
}

/* ── 7. Demo catalogue ───────────────────────────────────────────────────── */
if (config.seedDemo && dbMode === 'postgres') {
  add(
    'blocker',
    'Demo data',
    'SEED_DEMO_DATA defaults to true, so the first boot against the production database would stock the live shop with the demo sarees.',
    'Set SEED_DEMO_DATA=false for production (the seeder also only runs on an empty catalogue, so this must be set before the very first boot).',
  );
} else if (config.seedDemo) {
  add('ok', 'Demo data', 'seeding enabled — expected in in-memory/demo mode');
} else {
  add('ok', 'Demo data', 'disabled');
}

/* ── 8. Money: the UPI id the QR encodes ─────────────────────────────────── */
const upi = String(config.store.upi || '');
if (!upi) {
  add('blocker', 'UPI id', 'STORE_UPI is empty, so approval messages go out with no payable QR at all.', 'Set STORE_UPI to the real VPA, e.g. yourname@okhdfcbank.');
} else if (/@upi$/i.test(upi)) {
  add(
    'warn',
    'UPI id',
    `"${upi}" ends in the generic @upi handle. Scan the QR with a real UPI app and confirm it resolves to the store's account before customers do.`,
    'If it is a placeholder, replace it with the VPA shown in the shop owner\'s UPI app.',
  );
} else {
  add('ok', 'UPI id', upi);
}

/* ── 9. WhatsApp destination ─────────────────────────────────────────────── */
const waDigits = String(config.store.whatsapp || '').replace(/\D/g, '');
if (waDigits.length < 10 || waDigits.length > 15) {
  add(
    'blocker',
    'WhatsApp number',
    `STORE_WHATSAPP resolves to ${waDigits.length} digits — click-to-send links cannot open a chat without a full international number.`,
    'Use country code + number, no plus or spaces: 919822055443.',
  );
} else if (!/^\d{12}$/.test(waDigits)) {
  add('warn', 'WhatsApp number', `STORE_WHATSAPP is ${waDigits.length} digits; double-check the country code.`, 'Indian mobile numbers are 91 + 10 digits.');
} else {
  add('ok', 'WhatsApp number', `+${waDigits}`);
}

/* ── 10. Production build ────────────────────────────────────────────────── */
const distIndex = path.join(projectRoot, 'dist', 'index.html');
const newestSource = (() => {
  const walk = (dir) => {
    let newest = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      newest = Math.max(newest, entry.isDirectory() ? walk(abs) : fs.statSync(abs).mtimeMs);
    }
    return newest;
  };
  return fs.existsSync(path.join(projectRoot, 'src')) ? walk(path.join(projectRoot, 'src')) : 0;
})();

if (!fs.existsSync(distIndex)) {
  add(
    'warn',
    'Production build',
    'dist/index.html is missing, so the API has nothing to serve for the storefront — only /api/* would respond.',
    'Run npm run build. On the host, put it in the build step with dev dependencies installed: `npm install --include=dev && npm run build` (hosts that set NODE_ENV=production make npm skip vite and typescript, which breaks the build).',
  );
} else if (fs.statSync(distIndex).mtimeMs < newestSource) {
  add('warn', 'Production build', 'dist/ is older than the newest file in src/ — the bundle is stale.', 'Re-run npm run build.');
} else {
  add('ok', 'Production build', 'dist/ is present and newer than src/');
}

/* ── 11. Abuse controls ──────────────────────────────────────────────────── */
if (config.rateLimit.disabled) {
  add(
    'warn',
    'Rate limiting',
    'RATE_LIMIT_DISABLED is set, so the public enquiry form and the admin login are unthrottled.',
    'Unset RATE_LIMIT_DISABLED before going live.',
  );
} else if (fs.existsSync(path.join(projectRoot, 'server', 'services', 'ratelimit.js'))) {
  add(
    'ok',
    'Rate limiting',
    `active — ${config.rateLimit.loginMax} sign-ins, ${config.rateLimit.enquiryMax} enquiries and ${config.rateLimit.lookupMax} lookups per ${Math.round(
      config.rateLimit.windowMs / 60000,
    )} min per client IP`,
  );
} else {
  add(
    'warn',
    'Rate limiting',
    'POST /api/enquiries is public and unthrottled, and /api/admin/login accepts unlimited password guesses. Fine for a private demo, a spam magnet on a live domain.',
    'Add per-IP limits to both routes plus app.set(\'trust proxy\', …) so the real client IP is visible behind the host\'s proxy.',
  );
}

/* ── 11b. Proxy trust ────────────────────────────────────────────────────── */
if (config.trustProxy === false || config.trustProxy === 0) {
  add(
    'warn',
    'Proxy trust',
    'TRUST_PROXY is off, so express uses the socket address as the client IP and treats every request as http. Correct only when Node itself terminates TLS and nothing sits in front of it.',
    'If a platform load balancer, Cloudflare or nginx fronts the app, set TRUST_PROXY=1 (or to the proxy count).',
  );
} else {
  add('ok', 'Proxy trust', `trust proxy = ${JSON.stringify(config.trustProxy)} — real client IPs and https links work behind ${config.trustProxy} proxy hop(s)`);
}

/* ── 11c. Crawler + social surface ───────────────────────────────────────── */
const hasOgTags = fs.existsSync(path.join(projectRoot, 'index.html')) && /__PUBLIC_BASE_URL__/.test(fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8'));
const hasCrawlerRoutes = fs.existsSync(path.join(projectRoot, 'server', 'app.js'))
  && /sitemap\.xml/.test(fs.readFileSync(path.join(projectRoot, 'server', 'app.js'), 'utf8'))
  && /robots\.txt/.test(fs.readFileSync(path.join(projectRoot, 'server', 'app.js'), 'utf8'));
if (hasOgTags && hasCrawlerRoutes) {
  add('ok', 'SEO surface', '/robots.txt, /sitemap.xml and per-domain canonical/og tags are generated at request time');
} else {
  add('warn', 'SEO surface', 'Missing robots.txt, sitemap.xml or share-preview tags.', 'Without them a new domain indexes slowly and shares as a bare link.');
}

/* ── 12. Host descriptor ─────────────────────────────────────────────────── */
const descriptors = ['Dockerfile', 'render.yaml', 'Procfile', 'fly.toml', 'railway.json'].filter((file) => fs.existsSync(path.join(projectRoot, file)));
const hasDeployRunbook = fs.existsSync(path.join(projectRoot, 'DEPLOY.md'));
if (!hasDeployRunbook) {
  add('warn', 'Deploy runbook', 'DEPLOY.md is missing, so the domain/DNS/env steps live only in someone\'s head.', 'Add DEPLOY.md with the host setup, env reference and smoke tests.');
}
if (descriptors.length) {
  add('ok', 'Deploy config', descriptors.join(', '));
} else {
  add(
    'warn',
    'Deploy config',
    'No Dockerfile or platform descriptor in the repo.',
    'Not needed if the host uses its native Node runtime (build: npm run build, start: npm start). Add a Dockerfile for Fly.io, Railway or a VPS.',
  );
}

/* ── 13. Runtime ─────────────────────────────────────────────────────────── */
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
add('ok', 'Runtime', `Node ${process.version}${pkg.engines?.node ? ` (package.json requires ${pkg.engines.node})` : ' (no engines field)'}`);

/* ── Report ──────────────────────────────────────────────────────────────── */
const wrap = (text, width = 96) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width) {
      lines.push(line.trim());
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
};

const label = {
  blocker: C(31, '[BLOCKER]'),
  warn: C(33, '[WARN]   '),
  ok: C(32, '[OK]     '),
};
const order = { blocker: 0, warn: 1, ok: 2 };
results.sort((a, b) => order[a.level] - order[b.level]);

console.log('');
console.log(C(1, '  Sonali Paithani — deployment readiness'));
console.log(`  ${config.store.name} · database: ${dbMode} · storage: ${storageMode}`);
console.log(`  ${'─'.repeat(96)}`);
for (const item of results) {
  const lines = wrap(item.problem);
  console.log(`  ${label[item.level]} ${item.area.padEnd(17)} ${lines[0]}`);
  for (const line of lines.slice(1)) console.log(`  ${' '.repeat(10)} ${' '.repeat(17)} ${line}`);
  if (item.fix) {
    for (const line of wrap(item.fix)) console.log(`  ${' '.repeat(10)} ${C(90, `→ ${line}`)}`);
  }
}

const blockers = results.filter((r) => r.level === 'blocker').length;
const warnings = results.filter((r) => r.level === 'warn').length;
console.log(`  ${'─'.repeat(96)}`);
if (blockers) {
  console.log(`  ${C(31, C(1, `NOT READY`))} — ${blockers} blocker${blockers === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.`);
  console.log(`  ${C(90, 'Fix the blockers above, then re-run: npm run deploy:check')}`);
} else if (warnings) {
  console.log(`  ${C(33, C(1, 'READY TO DEPLOY'))} — 0 blockers, ${warnings} warning${warnings === 1 ? '' : 's'} to review.`);
} else {
  console.log(`  ${C(32, C(1, 'READY TO DEPLOY'))} — every check passed.`);
}
console.log(`  ${C(90, 'Runbook, env var reference and smoke tests: DEPLOY.md')}`);
console.log('');
process.exit(blockers ? 1 : 0);
