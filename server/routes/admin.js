import { Router } from 'express';
import multer from 'multer';
import { publicBase } from '../env.js';
import { one, q, tx } from '../db.js';
import { ensureAdminUser, hashPassword, newId, requireAdmin, signToken, verifyPassword } from '../auth.js';
import { loginLimiter } from '../services/ratelimit.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { httpError, previewApproval, approveEnquiry, recordMessage, setEnquiryStatus, listEnquiries, getEnquiry, enquiryStats, adjustStock } from '../services/enquiries.js';
import { bulkImport, collectionCounts, createProduct, getProduct, listProducts, productFacets, setProductFlags, updateProduct, slugify } from '../services/products.js';
import { deleteImage, saveImage, storageMode } from '../services/storage.js';
import {
  createExhibition,
  createLegacy,
  deleteExhibition,
  deleteLegacy,
  listExhibitions,
  listLegacy,
  updateExhibition,
  updateLegacy,
} from '../services/content.js';
import { DEFAULT_WHATSAPP_TEMPLATE } from '../services/whatsapp.js';

export const adminRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, AVIF or GIF images are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Photos and video clips for the Our Legacy and Exhibitions galleries.
 *
 * One file per request on purpose: multer buffers the whole upload in memory
 * before the handler runs, so a clip is streamed through only once — twelve
 * videos in a single request would multiply that buffer by twelve and can
 * exhaust a small instance. The dashboard uploads clips one at a time.
 */
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 48 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|avif|gif)$|^video\/(mp4|webm|quicktime|ogg)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, AVIF or GIF photos and MP4, WEBM, MOV or OGG videos are allowed'));
    }
    cb(null, true);
  },
});

adminRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    if (!email || !password) throw httpError(400, 'Email and password are required');
    await ensureAdminUser();
    const user = await one('select * from admin_users where email = $1', [email]);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw httpError(401, 'Incorrect email or password');
    }
    await q('update admin_users set last_login_at = now() where id = $1', [user.id]);
    res.json({
      token: signToken(user),
      admin: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/me', requireAdmin, (req, res) => res.json({ admin: req.admin }));

/**
 * Change the admin password from inside the dashboard.
 *
 * This exists because ADMIN_PASSWORD only seeds the account on the very first
 * boot: `ensureAdminUser()` inserts the row only when the email is missing, so
 * editing the env var afterwards has no effect. Rotating here writes the hash
 * the login actually checks, and needs the current password so a stolen token
 * alone cannot lock the owner out.
 */
adminRouter.post('/password', requireAdmin, async (req, res, next) => {
  try {
    const current = String(req.body?.current_password || '');
    const next_ = String(req.body?.new_password || '');
    const confirm = req.body?.confirm_password === undefined ? next_ : String(req.body.confirm_password);

    if (!current || !next_) throw httpError(400, 'Current and new password are both required');
    if (next_ !== confirm) throw httpError(400, 'The new passwords do not match');
    if (next_.length < 12) throw httpError(400, 'Choose a password of at least 12 characters');
    if (next_ === current) throw httpError(400, 'The new password is the same as the current one');

    const user = await one('select * from admin_users where id = $1', [req.admin.id]);
    if (!user) throw httpError(404, 'Account not found');
    if (!(await verifyPassword(current, user.password_hash))) throw httpError(401, 'The current password is incorrect');

    await q('update admin_users set password_hash = $2 where id = $1', [user.id, await hashPassword(next_)]);
    res.json({
      updated: true,
      message: 'Password changed. Sessions already signed in stay valid until they expire.',
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/meta', requireAdmin, async (_req, res) => {
  res.json({
    storage: storageMode,
    settings: await getSettings(),
    facets: await productFacets(),
  });
});

adminRouter.get('/stats', requireAdmin, async (_req, res) => res.json(await enquiryStats()));

/* ─── Products ─────────────────────────────────────────────────────────── */

adminRouter.get('/products', requireAdmin, async (req, res) => {
  const result = await listProducts({
    ...req.query,
    includeInactive: true,
    includeDeleted: req.query.include_deleted === 'true',
  });
  res.json(result);
});

adminRouter.post('/products', requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ product: await createProduct(req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/products/bulk', requireAdmin, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!items.length) throw httpError(400, 'Send a products array to import');
    res.status(201).json(await bulkImport(items));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/products/:id', requireAdmin, async (req, res) => {
  const product = await getProduct(req.params.id, { includeDeleted: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

adminRouter.patch('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ product: await updateProduct(req.params.id, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    if (req.query.hard === 'true') {
      const product = await getProduct(req.params.id, { includeDeleted: true });
      if (!product) throw httpError(404, 'Product not found');
      const [{ total }] = await q('select count(*)::int as total from enquiry_items where product_id = $1', [product.id]);
      if (total > 0) throw httpError(409, 'Product is part of past enquiries — deactivate it instead of deleting');
      await q('delete from products where id = $1', [product.id]);
      return res.json({ deleted: true, hard: true });
    }
    res.json({ product: await setProductFlags(req.params.id, { is_deleted: true, is_active: false }) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/products/:id/restore', requireAdmin, async (req, res, next) => {
  try {
    res.json({ product: await setProductFlags(req.params.id, { is_deleted: false, is_active: true }) });
  } catch (error) {
    next(error);
  }
});

/** Manual stock update with an audit trail. */
adminRouter.post('/products/:id/stock', requireAdmin, async (req, res, next) => {
  try {
    const delta = Number(req.body?.delta);
    const setTo = req.body?.set_to;
    if (!Number.isFinite(delta) && setTo === undefined) throw httpError(400, 'Send either delta or set_to');
    if (setTo !== undefined && (!Number.isFinite(Number(setTo)) || Number(setTo) < 0)) {
      throw httpError(400, 'Stock cannot be set to a negative number');
    }
    const product = await getProduct(req.params.id, { includeDeleted: true });
    if (!product) throw httpError(404, 'Product not found');
    const effectiveDelta = setTo === undefined ? delta : Number(setTo) - product.stock;
    const change = await tx((client) =>
      adjustStock(client, {
        productId: product.id,
        delta: effectiveDelta,
        reason: req.body?.reason || 'manual',
        reference: req.body?.reference || null,
        actor: req.admin.email,
      }),
    );
    res.json({ change, product: await getProduct(product.id, { includeDeleted: true }) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/products/:id/stock', requireAdmin, async (req, res) => {
  const product = await getProduct(req.params.id, { includeDeleted: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const movements = await q(
    'select * from stock_movements where product_id = $1 order by created_at desc limit 50',
    [product.id],
  );
  res.json({ current: product.stock, movements });
});

/* ─── Collections ──────────────────────────────────────────────────────── */

adminRouter.get('/collections', requireAdmin, async (_req, res) => {
  const [rows, counts] = await Promise.all([
    q('select * from collections order by sort_order asc, name asc'),
    collectionCounts({ includeInactive: true }),
  ]);
  res.json({ collections: rows.map((row) => ({ ...row, product_count: counts[row.slug] || 0 })) });
});

adminRouter.post('/collections', requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) throw httpError(400, 'Collection name is required');
    const id = newId();
    await q(
      `insert into collections (id, slug, name, tagline, description, image_url, sort_order, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        slugify(req.body?.slug || name),
        name,
        req.body?.tagline || null,
        req.body?.description || null,
        req.body?.image_url || null,
        Number(req.body?.sort_order) || 0,
        req.body?.is_active !== false,
      ],
    );
    res.status(201).json({ collection: await one('select * from collections where id = $1', [id]) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/collections/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await one('select * from collections where id = $1', [req.params.id]);
    if (!existing) throw httpError(404, 'Collection not found');
    const body = { ...existing, ...req.body };
    await q(
      `update collections set name = $2, tagline = $3, description = $4, image_url = $5,
         sort_order = $6, is_active = $7 where id = $1`,
      [
        existing.id,
        body.name,
        body.tagline ?? null,
        body.description ?? null,
        body.image_url ?? null,
        Number(body.sort_order) || 0,
        body.is_active !== false,
      ],
    );
    res.json({ collection: await one('select * from collections where id = $1', [existing.id]) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/collections/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await one('select * from collections where id = $1', [req.params.id]);
    if (!existing) throw httpError(404, 'Collection not found');
    await q('update collections set is_active = false where id = $1', [existing.id]);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

/* ─── Enquiries ────────────────────────────────────────────────────────── */

adminRouter.get('/enquiries', requireAdmin, async (req, res) => {
  res.json(await listEnquiries(req.query));
});

adminRouter.get('/enquiries/:id', requireAdmin, async (req, res, next) => {
  try {
    const enquiry = await getEnquiry(req.params.id);
    if (!enquiry) throw httpError(404, 'Enquiry not found');
    res.json({ enquiry });
  } catch (error) {
    next(error);
  }
});

/** Live preview of the WhatsApp message before approving. */
adminRouter.post('/enquiries/:id/preview', requireAdmin, async (req, res, next) => {
  try {
    res.json(await previewApproval(req.params.id, { ...(req.body || {}), baseUrl: publicBase(req) }));
  } catch (error) {
    next(error);
  }
});

/** Approve → optional stock release → returns the click-to-send WhatsApp link. */
adminRouter.post('/enquiries/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    res.json(await approveEnquiry(req.params.id, req.body || {}, req.admin.email, publicBase(req)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/enquiries/:id/sent', requireAdmin, async (req, res, next) => {
  try {
    res.json({ enquiry: await recordMessage(req.params.id, { body: req.body?.message, status: 'sent', actor: req.admin.email }) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/enquiries/:id/status', requireAdmin, async (req, res, next) => {
  try {
    res.json({
      enquiry: await setEnquiryStatus(req.params.id, String(req.body?.status || ''), {
        reason: req.body?.reason,
        actor: req.admin.email,
      }),
    });
  } catch (error) {
    next(error);
  }
});

/* ─── Our Legacy ───────────────────────────────────────────────────────── */

adminRouter.get('/legacy', requireAdmin, async (_req, res) => {
  res.json({ legacy: await listLegacy({ includeInactive: true }) });
});

adminRouter.post('/legacy', requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ entry: await createLegacy(req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/legacy/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ entry: await updateLegacy(req.params.id, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/legacy/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await deleteLegacy(req.params.id));
  } catch (error) {
    next(error);
  }
});

/* ─── Exhibitions ──────────────────────────────────────────────────────── */

adminRouter.get('/exhibitions', requireAdmin, async (_req, res) => {
  res.json({ exhibitions: await listExhibitions({ includeInactive: true }) });
});

adminRouter.post('/exhibitions', requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ exhibition: await createExhibition(req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/exhibitions/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ exhibition: await updateExhibition(req.params.id, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/exhibitions/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await deleteExhibition(req.params.id));
  } catch (error) {
    next(error);
  }
});

/* ─── Settings & uploads ───────────────────────────────────────────────── */

// `default_template` lets the dashboard offer "restore default" — templates
// saved before a new token (like {{payment_qr}}) existed stay editable.
adminRouter.get('/settings', requireAdmin, async (_req, res) =>
  res.json({ settings: await getSettings(), default_template: DEFAULT_WHATSAPP_TEMPLATE }),
);

adminRouter.put('/settings', requireAdmin, async (req, res, next) => {
  try {
    res.json({ settings: await updateSettings(req.body || {}) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/uploads', requireAdmin, upload.array('images', 12), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) throw httpError(400, 'No images received');
    const saved = [];
    for (const file of files) {
      saved.push(await saveImage({ buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype }));
    }
    res.status(201).json({ images: saved, urls: saved.map((item) => item.url) });
  } catch (error) {
    next(error);
  }
});

/**
 * One gallery photo or video clip. Returns a single URL; the dashboard loops
 * over the selected files so each upload is a separate, bounded request.
 */
adminRouter.post('/uploads/media', requireAdmin, mediaUpload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw httpError(400, 'No file received');
    const saved = await saveImage({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      folder: 'media',
    });
    res.status(201).json({ media: saved, url: saved.url });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/uploads', requireAdmin, async (req, res, next) => {
  try {
    const url = String(req.query.url || '');
    if (!url) throw httpError(400, 'url query parameter is required');
    res.json({ removed: await deleteImage(url) });
  } catch (error) {
    next(error);
  }
});
