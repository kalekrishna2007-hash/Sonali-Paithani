import { one, q } from '../db.js';
import { newId } from '../auth.js';
import { httpError } from './enquiries.js';

const SORTS = {
  newest: 'created_at desc',
  oldest: 'created_at asc',
  'price-asc': 'price asc',
  'price-desc': 'price desc',
  name: 'name asc',
  featured: 'is_featured desc, sort_order asc, created_at desc',
  stock: 'stock asc',
};

export const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || `item-${Date.now().toString(36)}`;

/** pg gives jsonb back as objects; pg-mem may hand back strings. Normalise both. */
export function parseJson(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function serializeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    price: Number(row.price || 0),
    compare_at_price: row.compare_at_price === null ? null : Number(row.compare_at_price),
    stock: Number(row.stock || 0),
    low_stock_threshold: Number(row.low_stock_threshold ?? 2),
    sizes: parseJson(row.sizes),
    colors: parseJson(row.colors),
    tags: parseJson(row.tags),
    images: parseJson(row.images),
    in_stock: Number(row.stock || 0) > 0,
  };
}

export async function listProducts(filters = {}) {
  const where = [];
  const params = [];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (!filters.includeDeleted) where.push('is_deleted = false');
  if (!filters.includeInactive) where.push('is_active = true');
  if (filters.collection) where.push(`collection_slug = ${push(filters.collection)}`);
  if (filters.occasion) where.push(`lower(occasion) = ${push(String(filters.occasion).toLowerCase())}`);
  if (filters.range) where.push(`lower(range_label) = ${push(String(filters.range).toLowerCase())}`);
  if (filters.featured) where.push('is_featured = true');
  if (filters.best_seller) where.push('is_best_seller = true');
  if (filters.new_arrival) where.push('is_new_arrival = true');
  if (filters.in_stock) where.push('stock > 0');
  if (filters.q) {
    const term = push(`%${String(filters.q).toLowerCase()}%`);
    where.push(
      `(lower(name) like ${term} or lower(coalesce(short_description,'')) like ${term}
        or lower(coalesce(description,'')) like ${term} or lower(coalesce(tags::text,'')) like ${term}
        or lower(coalesce(collection_slug,'')) like ${term})`,
    );
  }
  if (filters.price_min) where.push(`price >= ${push(Number(filters.price_min))}`);
  if (filters.price_max) where.push(`price <= ${push(Number(filters.price_max))}`);

  const clause = where.length ? `where ${where.join(' and ')}` : '';
  const order = SORTS[filters.sort] || SORTS.featured;
  const limit = Math.min(Math.max(Number(filters.limit) || 48, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const rows = await q(
    `select * from products ${clause} order by ${order} limit ${push(limit)} offset ${push(offset)}`,
    params,
  );
  const [countRow] = await q(`select count(*)::int as total from products ${clause}`, params.slice(0, -2));
  return { rows: rows.map(serializeProduct), total: countRow?.total || 0 };
}

export async function getProduct(slugOrId, { includeDeleted = false } = {}) {
  const row = await one(
    `select * from products where (id = $1 or slug = $1) ${includeDeleted ? '' : 'and is_deleted = false'}`,
    [String(slugOrId)],
  );
  return serializeProduct(row);
}

async function uniqueSlug(base, ignoreId = null) {
  let slug = slugify(base);
  let suffix = 1;
  /* eslint-disable no-await-in-loop */
  while (true) {
    const existing = await one('select id from products where slug = $1', [slug]);
    if (!existing || existing.id === ignoreId) return slug;
    suffix += 1;
    slug = `${slugify(base)}-${suffix}`;
  }
}

function normalisePayload(body = {}) {
  return {
    name: String(body.name || '').trim(),
    short_description: body.short_description ? String(body.short_description).slice(0, 300) : null,
    description: body.description ? String(body.description) : null,
    collection_slug: body.collection_slug ? slugify(body.collection_slug) : null,
    occasion: body.occasion ? String(body.occasion) : null,
    range_label: body.range_label ? String(body.range_label) : null,
    fabric: body.fabric ? String(body.fabric) : null,
    weave: body.weave ? String(body.weave) : null,
    work: body.work ? String(body.work) : null,
    care: body.care ? String(body.care) : null,
    dimensions: body.dimensions ? String(body.dimensions) : null,
    sku: body.sku ? String(body.sku).slice(0, 60) : null,
    price: Number(body.price) || 0,
    compare_at_price: body.compare_at_price === '' || body.compare_at_price == null
      ? null
      : Number(body.compare_at_price),
    price_on_request: body.price_on_request !== false,
    stock: Math.max(Number(body.stock) || 0, 0),
    low_stock_threshold: Math.max(Number(body.low_stock_threshold ?? 2), 0),
    sizes: Array.from(new Set((Array.isArray(body.sizes) ? body.sizes : []).map((s) => String(s).trim()).filter(Boolean))),
    colors: Array.from(new Set((Array.isArray(body.colors) ? body.colors : []).map((s) => String(s).trim()).filter(Boolean))),
    tags: Array.from(new Set((Array.isArray(body.tags) ? body.tags : []).map((s) => String(s).trim()).filter(Boolean))),
    images: (Array.isArray(body.images) ? body.images : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 30),
    is_featured: Boolean(body.is_featured),
    is_best_seller: Boolean(body.is_best_seller),
    is_new_arrival: Boolean(body.is_new_arrival),
    is_active: body.is_active !== false,
    sort_order: Number(body.sort_order) || 0,
  };
}

export async function createProduct(body = {}) {
  const data = normalisePayload(body);
  if (data.name.length < 3) throw httpError(400, 'Product name is required');
  const id = newId();
  const slug = await uniqueSlug(body.slug || data.name);
  await q(
    `insert into products
       (id, slug, sku, name, short_description, description, collection_slug, occasion, range_label,
        fabric, weave, work, care, dimensions, price, compare_at_price, price_on_request, stock,
        low_stock_threshold, sizes, colors, tags, images, is_featured, is_best_seller, is_new_arrival,
        is_active, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
    [
      id, slug, data.sku, data.name, data.short_description, data.description, data.collection_slug,
      data.occasion, data.range_label, data.fabric, data.weave, data.work, data.care, data.dimensions,
      data.price, data.compare_at_price, data.price_on_request, data.stock, data.low_stock_threshold,
      JSON.stringify(data.sizes), JSON.stringify(data.colors), JSON.stringify(data.tags),
      JSON.stringify(data.images), data.is_featured, data.is_best_seller, data.is_new_arrival,
      data.is_active, data.sort_order,
    ],
  );
  if (data.stock > 0) {
    await q(
      `insert into stock_movements (id, product_id, delta, balance, reason, actor)
       values ($1,$2,$3,$4,'created','admin')`,
      [newId(), id, data.stock, data.stock],
    );
  }
  return getProduct(id);
}

export async function updateProduct(idOrSlug, body = {}) {
  const existing = await getProduct(idOrSlug, { includeDeleted: true });
  if (!existing) throw httpError(404, 'Product not found');
  const data = normalisePayload({ ...existing, ...body });
  const slug = body.slug ? await uniqueSlug(body.slug, existing.id) : existing.slug;
  await q(
    `update products set
       slug = $2, sku = $3, name = $4, short_description = $5, description = $6, collection_slug = $7,
       occasion = $8, range_label = $9, fabric = $10, weave = $11, work = $12, care = $13,
       dimensions = $14, price = $15, compare_at_price = $16, price_on_request = $17,
       low_stock_threshold = $19, sizes = $20, colors = $21, tags = $22, images = $23,
       is_featured = $24, is_best_seller = $25, is_new_arrival = $26, is_active = $27,
       sort_order = $28, updated_at = now()
     where id = $1`,
    [
      existing.id, slug, data.sku, data.name, data.short_description, data.description, data.collection_slug,
      data.occasion, data.range_label, data.fabric, data.weave, data.work, data.care, data.dimensions,
      data.price, data.compare_at_price, data.price_on_request, data.stock, data.low_stock_threshold,
      JSON.stringify(data.sizes), JSON.stringify(data.colors), JSON.stringify(data.tags),
      JSON.stringify(data.images), data.is_featured, data.is_best_seller, data.is_new_arrival,
      data.is_active, data.sort_order,
    ],
  );
  return getProduct(existing.id, { includeDeleted: true });
}

/** Soft delete keeps the record (and old enquiry history) intact. */
export async function setProductFlags(idOrSlug, flags = {}) {
  const existing = await getProduct(idOrSlug, { includeDeleted: true });
  if (!existing) throw httpError(404, 'Product not found');
  const deleted = flags.is_deleted ?? existing.is_deleted;
  await q(
    `update products set is_deleted = $2, is_active = $3, updated_at = now() where id = $1`,
    [existing.id, Boolean(deleted), flags.is_active ?? existing.is_active],
  );
  return getProduct(existing.id, { includeDeleted: true });
}

export async function bulkImport(products = []) {
  const created = [];
  const failed = [];
  for (const item of products) {
    try {
      created.push(await createProduct(item));
    } catch (error) {
      failed.push({ name: item?.name || 'unnamed', error: error.message });
    }
  }
  return { created, failed, created_count: created.length, failed_count: failed.length };
}

/** Live product counts per collection slug (kept as a plain GROUP BY so it runs
 *  identically on Supabase Postgres and the in-memory dev engine). */
export async function collectionCounts({ includeInactive = false } = {}) {
  const rows = await q(
    `select collection_slug, count(*)::int as total from products
     where is_deleted = false ${includeInactive ? '' : 'and is_active = true'}
       and collection_slug is not null
     group by collection_slug`,
  );
  return Object.fromEntries(rows.map((row) => [row.collection_slug, row.total]));
}

export async function productFacets() {
  const rows = await q(
    `select collection_slug, occasion, range_label, count(*)::int as total from products
     where is_deleted = false group by collection_slug, occasion, range_label`,
  );
  const group = (key) => {
    const map = new Map();
    rows.forEach((row) => {
      const value = row[key];
      if (!value) return;
      map.set(value, (map.get(value) || 0) + row.total);
    });
    return [...map.entries()].map(([value, total]) => ({ value, total })).sort((a, b) => b.total - a.total);
  };
  return { collections: group('collection_slug'), occasions: group('occasion'), ranges: group('range_label') };
}
