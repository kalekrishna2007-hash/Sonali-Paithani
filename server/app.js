import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { config, projectRoot, publicBase } from './env.js';
import { q, uploadsDir } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

/**
 * The SPA shell is the storefront's landing page, so it is also what social
 * crawlers read. Express fills these placeholders with the host the request
 * arrived on, which means the same build works on localhost, on the staging
 * URL and on the live domain without a rebuild.
 */
const BASE_URL_PLACEHOLDER = '__PUBLIC_BASE_URL__';

const escapeHtml = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Conservative headers — no CSP, because fonts and inline styles are remote. */
function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Static routes worth indexing, paired with how often they change. */
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/legacy', changefreq: 'weekly', priority: '0.7' },
  { path: '/exhibitions', changefreq: 'weekly', priority: '0.7' },
];

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Required for correct rate-limit keys and https URLs behind a host proxy.
  app.set('trust proxy', config.trustProxy);

  const origins = config.corsOrigin
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true, credentials: false }));
  app.use(express.json({ limit: '2mb' }));
  app.use(securityHeaders);

  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', index: false }));

  /**
   * Crawler files. Generated rather than static so the URLs always match the
   * domain the store is actually being served from.
   */
  app.get('/robots.txt', (req, res) => {
    const origin = publicBase(req);
    res.type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n'));
  });

  app.get('/sitemap.xml', async (req, res) => {
    const origin = publicBase(req);
    const today = new Date().toISOString().slice(0, 10);
    const urls = STATIC_PAGES.map((page) => ({ loc: `${origin}${page.path}`, changefreq: page.changefreq, priority: page.priority, lastmod: today }));

    try {
      const [products, collections] = await Promise.all([
        q('select slug, updated_at from products where is_active = true and is_deleted = false order by sort_order asc limit 5000'),
        q('select slug from collections where is_active = true order by sort_order asc'),
      ]);
      for (const row of collections) {
        urls.push({ loc: `${origin}/shop?collection=${encodeURIComponent(row.slug)}`, changefreq: 'weekly', priority: '0.8', lastmod: today });
      }
      for (const row of products) {
        urls.push({
          loc: `${origin}/shop/${encodeURIComponent(row.slug)}`,
          changefreq: 'weekly',
          priority: '0.6',
          lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : today,
        });
      }
    } catch (error) {
      // A sitemap without the catalogue beats a 500 for every crawler.
      console.error('[sitemap]', error.message);
    }

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (url) =>
          `  <url><loc>${xmlEscape(url.loc)}</loc><lastmod>${url.lastmod}</lastmod><changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`,
      ),
      '</urlset>',
      '',
    ].join('\n');
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(body);
  });

  const distDir = path.join(projectRoot, 'dist');
  const hasBuild = fs.existsSync(path.join(distDir, 'index.html'));
  if (hasBuild) app.use(express.static(distDir, { index: false }));

  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));

  // Serve the built SPA (storefront + admin) for any non-API GET.
  if (hasBuild) {
    const shell = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    app.get('*', (req, res) => {
      const html = shell.replaceAll(BASE_URL_PLACEHOLDER, escapeHtml(publicBase(req)));
      res.type('html').send(html);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error('[api]', error);
    res.status(status).json({ error: error.message || 'Something went wrong on our side' });
  });

  return app;
}
