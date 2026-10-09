import { one, q, tx } from '../db.js';
import { newId } from '../auth.js';
import { buildApprovalWhatsApp, normalizePhone } from './whatsapp.js';
import { getSettings } from './settings.js';

export const ENQUIRY_STATUSES = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];

const money = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : 0;
};

async function nextReference(client) {
  const row = await client.one('select count(*)::int as total from enquiries');
  const year = new Date().getFullYear();
  const sequence = String((row?.total || 0) + 1).padStart(4, '0');
  return `SP-${year}-${sequence}`;
}

/**
 * A customer enquiry. Prices always come from the product record, never from the
 * browser, so nobody can edit the value on the way in.
 */
export async function createEnquiry(payload = {}) {
  const name = String(payload.customer_name || '').trim();
  const phone = String(payload.phone || '').trim();
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!rawItems.length) {
    throw httpError(400, 'An enquiry is for a specific saree — open a saree and send the enquiry from there');
  }
  if (name.length < 2) throw httpError(400, 'Please share your name');
  if (normalizePhone(phone).length < 8) throw httpError(400, 'Please share a valid WhatsApp number');

  const prepared = [];
  for (const raw of rawItems.slice(0, 20)) {
    const reference = String(raw.product_id || raw.slug || '').trim();
    if (!reference) {
      throw httpError(400, 'Every enquiry line must name the saree it is for — please pick the saree first');
    }
    const product = await one(
      'select id, name, slug, price, images, is_active, is_deleted from products where id = $1 or slug = $1',
      [reference],
    );
    if (!product || product.is_deleted || !product.is_active) continue;
    const quantity = Math.min(Math.max(Number(raw.quantity) || 1, 1), 20);
    const unitPrice = money(raw.unit_price ?? product.price);
    prepared.push({
      id: newId(),
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      unit_price: unitPrice,
      quantity,
      size: raw.size ? String(raw.size).slice(0, 60) : null,
      color: raw.color ? String(raw.color).slice(0, 60) : null,
      notes: raw.notes ? String(raw.notes).slice(0, 300) : null,
      line_total: money(unitPrice * quantity),
    });
  }
  if (!prepared.length) throw httpError(400, 'Those sarees are no longer available — please pick them again');

  const enquiryId = newId();
  const enquiry = await tx(async (client) => {
    const reference = await nextReference(client);
    const total = prepared.reduce((sum, item) => sum + item.line_total, 0);
    const row = (
      await client.q(
        `insert into enquiries
           (id, reference, customer_name, phone, whatsapp, email, city, country, occasion_date,
            customer_note, source, status, item_count, quoted_total)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13)
         returning *`,
        [
          enquiryId,
          reference,
          name,
          normalizePhone(phone),
          normalizePhone(payload.whatsapp || phone),
          payload.email ? String(payload.email).trim().slice(0, 160) : null,
          payload.city ? String(payload.city).trim().slice(0, 80) : null,
          payload.country ? String(payload.country).trim().slice(0, 80) : 'India',
          payload.occasion_date ? String(payload.occasion_date).slice(0, 40) : null,
          payload.customer_note ? String(payload.customer_note).slice(0, 1000) : null,
          payload.source === 'wishlist' ? 'wishlist' : 'website',
          prepared.length,
          total,
        ],
      )
    )[0];

    for (const item of prepared) {
      await client.q(
        `insert into enquiry_items
           (id, enquiry_id, product_id, product_name, product_slug, unit_price, quantity, size, color, notes, line_total)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          item.id,
          enquiryId,
          item.product_id,
          item.product_name,
          item.product_slug,
          item.unit_price,
          item.quantity,
          item.size,
          item.color,
          item.notes,
          item.line_total,
        ],
      );
    }
    return row;
  });

  return { enquiry, items: prepared };
}

export async function getEnquiry(idOrReference) {
  const enquiry = await one('select * from enquiries where id = $1 or reference = $1', [String(idOrReference)]);
  if (!enquiry) return null;
  const items = await q('select * from enquiry_items where enquiry_id = $1', [enquiry.id]);
  const messages = await q(
    'select * from message_log where enquiry_id = $1 order by created_at desc limit 20',
    [enquiry.id],
  );
  return { ...enquiry, items, messages };
}

export async function listEnquiries({ status, search, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status && status !== 'all') {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where.push(
      `(lower(customer_name) like $${params.length} or reference ilike $${params.length} or phone like $${params.length})`,
    );
  }
  const clause = where.length ? `where ${where.join(' and ')}` : '';
  params.push(Math.min(Number(limit) || 100, 500), Number(offset) || 0);
  const rows = await q(
    `select * from enquiries ${clause} order by
       case status when 'pending' then 0 when 'approved' then 1 else 2 end,
       created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  const counts = await q('select status, count(*)::int as total from enquiries group by status');
  return { rows: await withItems(rows), counts: Object.fromEntries(counts.map((c) => [c.status, c.total])) };
}

/**
 * Attaches the sarees each enquiry is for, so lists can show the piece rather
 * than a bare count. One query for the whole page (pg-mem friendly).
 */
async function withItems(rows) {
  const ids = rows.map((row) => row.id);
  if (!ids.length) return rows.map((row) => ({ ...row, items: [] }));
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const items = await q(
    `select enquiry_id, product_name, product_slug, quantity, size, color from enquiry_items
     where enquiry_id in (${placeholders}) order by product_name asc`,
    ids,
  );
  const grouped = new Map();
  for (const item of items) {
    const list = grouped.get(item.enquiry_id) || [];
    list.push(item);
    grouped.set(item.enquiry_id, list);
  }
  return rows.map((row) => ({ ...row, items: grouped.get(row.id) || [] }));
}

/**
 * Adjusts stock and writes an audit row. Balances are allowed to go negative so
 * that overselling an approved order stays visible on the dashboard instead of
 * being silently swallowed at zero. Also used by "update stock" in admin.
 */
export async function adjustStock(client, { productId, delta, reason = 'manual', reference = null, actor = 'admin' }) {
  const product = (
    await client.q('select id, name, stock from products where id = $1', [productId])
  )[0];
  if (!product) throw httpError(404, 'Product not found');
  const change = Number(delta || 0);
  const balance = Number(product.stock || 0) + change;
  await client.q('update products set stock = $2, updated_at = now() where id = $1', [productId, balance]);
  await client.q(
    `insert into stock_movements (id, product_id, delta, balance, reason, reference, actor)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [newId(), productId, change, balance, reason, reference, actor],
  );
  return {
    product_id: productId,
    name: product.name,
    balance,
    delta: change,
    oversold: balance < 0,
  };
}

export async function previewApproval(enquiryId, overrides = {}) {
  const enquiry = await getEnquiry(enquiryId);
  if (!enquiry) throw httpError(404, 'Enquiry not found');
  const settings = await getSettings();
  const { baseUrl, ...payload } = overrides;
  return {
    enquiry,
    whatsapp: buildApprovalWhatsApp({ enquiry, items: enquiry.items, settings, overrides: payload, baseUrl }),
  };
}

/**
 * Approving: optionally releases stock, freezes the final quote, renders the
 * (admin-editable) WhatsApp message and returns a click-to-send link.
 */
export async function approveEnquiry(enquiryId, body = {}, actor = 'admin', baseUrl = '') {
  const existing = await getEnquiry(enquiryId);
  if (!existing) throw httpError(404, 'Enquiry not found');
  if (existing.status === 'completed') throw httpError(409, 'This enquiry is already completed');

  const settings = await getSettings();
  const total = money(body.total_amount ?? existing.quoted_total ?? 0);
  const advance = money(body.advance_amount ?? existing.advance_amount ?? 0);

  const whatsapp = buildApprovalWhatsApp({
    enquiry: { ...existing, quoted_total: total, advance_amount: advance },
    items: existing.items,
    settings,
    overrides: { template: body.message, payment_note: body.payment_note ?? existing.payment_note },
    baseUrl,
  });

  const stockChanges = await tx(async (client) => {
    await client.q(
      `update enquiries set status = 'approved', quoted_total = $2, advance_amount = $3,
         payment_note = $4, admin_note = coalesce($5, admin_note), last_message = $6,
         approved_at = now(), updated_at = now()
       where id = $1`,
      [
        existing.id,
        total,
        advance,
        body.payment_note ?? existing.payment_note ?? null,
        body.admin_note ?? null,
        whatsapp.message,
      ],
    );

    if (body.deduct_stock && !existing.stock_released) {
      const changes = [];
      for (const item of existing.items) {
        if (!item.product_id) continue;
        changes.push(
          await adjustStock(client, {
            productId: item.product_id,
            delta: -Number(item.quantity || 1),
            reason: 'enquiry-approved',
            reference: existing.reference,
            actor,
          }),
        );
      }
      await client.q('update enquiries set stock_released = true where id = $1', [existing.id]);
      return changes;
    }
    return [];
  });

  const enquiry = await getEnquiry(existing.id);
  return { enquiry, whatsapp, stock_changes: stockChanges };
}

export async function recordMessage(enquiryId, { body, status = 'sent', actor = 'admin' } = {}) {
  const enquiry = await getEnquiry(enquiryId);
  if (!enquiry) throw httpError(404, 'Enquiry not found');
  await q(
    `insert into message_log (id, enquiry_id, channel, phone, body, status, provider, actor)
     values ($1,$2,'whatsapp',$3,$4,$5,'wa.me',$6)`,
    [newId(), enquiry.id, enquiry.whatsapp || enquiry.phone, body || enquiry.last_message || '', status, actor],
  );
  await q(
    `update enquiries set whatsapp_sent_at = case when $2 = 'sent' then now() else whatsapp_sent_at end,
       status = case when status = 'approved' and $2 = 'sent' then 'approved' else status end,
       updated_at = now()
     where id = $1`,
    [enquiry.id, status],
  );
  return getEnquiry(enquiry.id);
}

export async function setEnquiryStatus(enquiryId, status, { reason, actor = 'admin' } = {}) {
  if (!ENQUIRY_STATUSES.includes(status)) throw httpError(400, 'Unknown status');
  const enquiry = await getEnquiry(enquiryId);
  if (!enquiry) throw httpError(404, 'Enquiry not found');

  await tx(async (client) => {
    await client.q(
      `update enquiries set status = $2, rejection_reason = $3, updated_at = now() where id = $1`,
      [enquiry.id, status, reason ? String(reason).slice(0, 500) : enquiry.rejection_reason],
    );
    // Returning stock when an approved order is cancelled or rejected.
    if (['rejected', 'cancelled'].includes(status) && enquiry.stock_released) {
      for (const item of enquiry.items) {
        if (!item.product_id) continue;
        await adjustStock(client, {
          productId: item.product_id,
          delta: Number(item.quantity || 1),
          reason: `enquiry-${status}`,
          reference: enquiry.reference,
          actor,
        });
      }
      await client.q('update enquiries set stock_released = false where id = $1', [enquiry.id]);
    }
  });

  return getEnquiry(enquiry.id);
}

export async function enquiryStats() {
  // CASE WHEN instead of FILTER for identical behaviour on every Postgres build.
  const [totals] = await q(`select
      count(*)::int as total,
      sum(case when status = 'pending' then 1 else 0 end)::int as pending,
      sum(case when status = 'approved' then 1 else 0 end)::int as approved,
      sum(case when status = 'completed' then 1 else 0 end)::int as completed,
      sum(case when status = 'rejected' then 1 else 0 end)::int as rejected,
      coalesce(sum(case when status in ('approved','completed') then quoted_total else 0 end), 0)::float as approved_value,
      coalesce(sum(case when status = 'completed' then quoted_total else 0 end), 0)::float as earned_value
    from enquiries`);
  const [products] = await q(`select
      sum(case when not is_deleted then 1 else 0 end)::int as total,
      sum(case when not is_deleted and is_active then 1 else 0 end)::int as active,
      sum(case when not is_deleted and stock <= 0 then 1 else 0 end)::int as out_of_stock,
      sum(case when not is_deleted and stock > 0 and stock <= low_stock_threshold then 1 else 0 end)::int as low_stock,
      coalesce(sum(case when not is_deleted then stock else 0 end), 0)::int as units
    from products`);
  const recent = await q(
    `select reference, customer_name, status, quoted_total, created_at from enquiries order by created_at desc limit 6`,
  );
  const lowStock = await q(
    `select id, name, stock, low_stock_threshold from products
     where not is_deleted and stock <= low_stock_threshold order by stock asc limit 8`,
  );
  return { enquiries: totals, products, recent, low_stock: lowStock };
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
