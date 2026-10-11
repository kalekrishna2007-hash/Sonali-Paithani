import { Router } from 'express';
import { q } from '../db.js';
import { getSettings, publicSettings } from '../services/settings.js';
import { collectionCounts, getProduct, listProducts, productFacets } from '../services/products.js';
import { createEnquiry, getEnquiry } from '../services/enquiries.js';
import { listExhibitions, listLegacy } from '../services/content.js';
import { normalizePhone } from '../services/whatsapp.js';
import { upiLink, qrPng, qrScaleFor } from '../services/qr.js';
import { enquiryLimiter, lookupLimiter } from '../services/ratelimit.js';

export const publicRouter = Router();

publicRouter.get('/health', async (_req, res) => {
  const settings = await getSettings();
  res.json({ ok: true, store: settings.store_name, time: new Date().toISOString() });
});

publicRouter.get('/settings', async (_req, res) => {
  res.json(await publicSettings());
});

publicRouter.get('/collections', async (_req, res) => {
  const [rows, counts] = await Promise.all([
    q('select * from collections where is_active = true order by sort_order asc, name asc'),
    collectionCounts(),
  ]);
  res.json({ collections: rows.map((row) => ({ ...row, product_count: counts[row.slug] || 0 })) });
});

publicRouter.get('/facets', async (_req, res) => {
  res.json(await productFacets());
});

/** Our Legacy — photos and videos of personalities wearing a Paithani. */
publicRouter.get('/legacy', async (_req, res) => {
  res.json({ legacy: await listLegacy() });
});

/** Exhibitions — photos and videos from the shows the studio has taken part in. */
publicRouter.get('/exhibitions', async (_req, res) => {
  res.json({ exhibitions: await listExhibitions() });
});

/**
 * Payment QR (PNG) for a UPI id — the image linked from the approval message.
 * Everything needed is in the query string, so the URL stays a plain link.
 */
publicRouter.get('/qr/upi.png', (req, res, next) => {
  try {
    const { pa, pn, am, tn, size } = req.query;
    const link = upiLink({ upi: pa, payee: pn, amount: am === undefined ? undefined : Number(am), note: tn });
    const wanted = Number(size);
    const target = Number.isFinite(wanted) ? Math.min(1024, Math.max(160, Math.round(wanted))) : 480;
    const png = qrPng(link, { scale: qrScaleFor(link, target) });
    res.type('png').set('Cache-Control', 'public, max-age=86400').send(png);
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/products', async (req, res) => {
  const { q: search, collection, occasion, range, sort, featured, best_seller, new_arrival, in_stock, limit, offset, price_min, price_max } = req.query;
  const result = await listProducts({
    q: search,
    collection,
    occasion,
    range,
    sort,
    featured: featured === 'true',
    best_seller: best_seller === 'true',
    new_arrival: new_arrival === 'true',
    in_stock: in_stock === 'true',
    price_min,
    price_max,
    limit,
    offset,
  });
  res.json(result);
});

publicRouter.get('/products/:slug', async (req, res) => {
  const product = await getProduct(req.params.slug);
  if (!product) return res.status(404).json({ error: 'This saree is no longer available' });
  const related = await listProducts({ collection: product.collection_slug, limit: 4 });
  res.json({
    product,
    related: related.rows.filter((row) => row.id !== product.id).slice(0, 3),
  });
});

/** Customer submits an enquiry — this is what lands on the admin dashboard. */
publicRouter.post('/enquiries', enquiryLimiter, async (req, res, next) => {
  try {
    const { enquiry, items } = await createEnquiry(req.body || {});
    res.status(201).json({
      enquiry: {
        id: enquiry.id,
        reference: enquiry.reference,
        status: enquiry.status,
        customer_name: enquiry.customer_name,
        quoted_total: Number(enquiry.quoted_total || 0),
        item_count: enquiry.item_count,
      },
      items: items.map(({ product_name, quantity, size, color, line_total }) => ({
        product_name,
        quantity,
        size,
        color,
        line_total,
      })),
      message: `Thank you ${enquiry.customer_name.split(' ')[0]}! Your enquiry ${enquiry.reference} is with our studio.`,
    });
  } catch (error) {
    next(error);
  }
});

/** Let a customer check progress with their reference + registered number. */
publicRouter.get('/enquiries/:reference', lookupLimiter, async (req, res) => {
  const enquiry = await getEnquiry(req.params.reference);
  const phone = normalizePhone(req.query.phone || '');
  if (!enquiry || (phone && phone !== enquiry.phone && phone !== enquiry.whatsapp)) {
    return res.status(404).json({ error: 'No enquiry found for that reference and number' });
  }
  res.json({
    reference: enquiry.reference,
    status: enquiry.status,
    customer_name: enquiry.customer_name,
    quoted_total: enquiry.quoted_total,
    advance_amount: enquiry.advance_amount,
    created_at: enquiry.created_at,
    approved_at: enquiry.approved_at,
    items: enquiry.items.map((item) => ({ product_name: item.product_name, quantity: item.quantity })),
  });
});
