import { one, q } from '../db.js';
import { newId } from '../auth.js';
import { httpError } from './enquiries.js';
import { parseJson } from './products.js';

const text = (value, max = 4000) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

const imageList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);

const activeFlag = (value) => value !== false && value !== 'false' && value !== 0 && value !== '0';

/* ─── Our Legacy ───────────────────────────────────────────────────────── */

export function serializeLegacy(row) {
  if (!row) return null;
  return {
    ...row,
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active !== false,
  };
}

export async function listLegacy({ includeInactive = false } = {}) {
  const rows = await q(
    `select * from legacy_reviews ${includeInactive ? '' : 'where is_active = true'}
     order by sort_order asc, created_at desc`,
  );
  return rows.map(serializeLegacy);
}

export async function createLegacy(body = {}) {
  const celebrity_name = text(body.celebrity_name, 120);
  if (!celebrity_name || celebrity_name.length < 2) throw httpError(400, 'Add the name of the personality');
  const id = newId();
  await q(
    `insert into legacy_reviews (id, celebrity_name, title, review, image_url, sort_order, is_active)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      celebrity_name,
      text(body.title, 160),
      text(body.review, 4000),
      text(body.image_url, 500),
      Number(body.sort_order) || 0,
      activeFlag(body.is_active),
    ],
  );
  return serializeLegacy(await one('select * from legacy_reviews where id = $1', [id]));
}

export async function updateLegacy(id, body = {}) {
  const existing = await one('select * from legacy_reviews where id = $1', [id]);
  if (!existing) throw httpError(404, 'Legacy entry not found');
  const merged = { ...existing, ...body };
  const celebrity_name = text(merged.celebrity_name, 120);
  if (!celebrity_name || celebrity_name.length < 2) throw httpError(400, 'Add the name of the personality');
  await q(
    `update legacy_reviews set celebrity_name = $2, title = $3, review = $4, image_url = $5,
       sort_order = $6, is_active = $7 where id = $1`,
    [
      existing.id,
      celebrity_name,
      text(merged.title, 160),
      text(merged.review, 4000),
      text(merged.image_url, 500),
      Number(merged.sort_order) || 0,
      activeFlag(merged.is_active),
    ],
  );
  return serializeLegacy(await one('select * from legacy_reviews where id = $1', [existing.id]));
}

export async function deleteLegacy(id) {
  const existing = await one('select * from legacy_reviews where id = $1', [id]);
  if (!existing) throw httpError(404, 'Legacy entry not found');
  await q('delete from legacy_reviews where id = $1', [existing.id]);
  return { deleted: true };
}

/* ─── Exhibitions ──────────────────────────────────────────────────────── */

export function serializeExhibition(row) {
  if (!row) return null;
  return {
    ...row,
    images: parseJson(row.images),
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active !== false,
  };
}

export async function listExhibitions({ includeInactive = false } = {}) {
  const rows = await q(
    `select * from exhibitions ${includeInactive ? '' : 'where is_active = true'}
     order by sort_order asc, created_at desc`,
  );
  return rows.map(serializeExhibition);
}

export async function createExhibition(body = {}) {
  const title = text(body.title, 160);
  if (!title || title.length < 2) throw httpError(400, 'Give the exhibition a title');
  const id = newId();
  await q(
    `insert into exhibitions (id, title, location, event_date, description, images, sort_order, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      title,
      text(body.location, 200),
      text(body.event_date, 80),
      text(body.description, 4000),
      JSON.stringify(imageList(body.images)),
      Number(body.sort_order) || 0,
      activeFlag(body.is_active),
    ],
  );
  return serializeExhibition(await one('select * from exhibitions where id = $1', [id]));
}

export async function updateExhibition(id, body = {}) {
  const existing = await one('select * from exhibitions where id = $1', [id]);
  if (!existing) throw httpError(404, 'Exhibition not found');
  const merged = { ...serializeExhibition(existing), ...body };
  const title = text(merged.title, 160);
  if (!title || title.length < 2) throw httpError(400, 'Give the exhibition a title');
  await q(
    `update exhibitions set title = $2, location = $3, event_date = $4, description = $5,
       images = $6, sort_order = $7, is_active = $8 where id = $1`,
    [
      existing.id,
      title,
      text(merged.location, 200),
      text(merged.event_date, 80),
      text(merged.description, 4000),
      JSON.stringify(imageList(merged.images)),
      Number(merged.sort_order) || 0,
      activeFlag(merged.is_active),
    ],
  );
  return serializeExhibition(await one('select * from exhibitions where id = $1', [existing.id]));
}

export async function deleteExhibition(id) {
  const existing = await one('select * from exhibitions where id = $1', [id]);
  if (!existing) throw httpError(404, 'Exhibition not found');
  await q('delete from exhibitions where id = $1', [existing.id]);
  return { deleted: true };
}
