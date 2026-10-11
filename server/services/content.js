import { one, q } from '../db.js';
import { newId } from '../auth.js';
import { httpError } from './enquiries.js';
import { parseJson } from './products.js';

const text = (value, max = 4000) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

const mediaList = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 24);

const activeFlag = (value) => value !== false && value !== 'false' && value !== 0 && value !== '0';

/* ─── Our Legacy ───────────────────────────────────────────────────────── */

/**
 * Entries stored before this section became a gallery only have the old
 * single-photo column, so fall back to it until the entry is saved again.
 */
const legacyMedia = (row) => {
  const media = mediaList(row.media);
  if (media.length) return media;
  const single = text(row.image_url, 500);
  return single ? [single] : [];
};

const exhibitionMedia = (row) => {
  const media = mediaList(row.media);
  return media.length ? media : mediaList(parseJson(row.images));
};

/**
 * Photos and videos only — no name, role or quote is read out of the row, so
 * nothing about the person can leak to the storefront.
 */
export function serializeLegacy(row) {
  if (!row) return null;
  return {
    id: row.id,
    media: legacyMedia(row),
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active !== false,
    created_at: row.created_at,
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
  const media = mediaList(body.media);
  if (!media.length) throw httpError(400, 'Add at least one photo or video');
  const id = newId();
  await q(
    `insert into legacy_reviews (id, media, sort_order, is_active)
     values ($1,$2,$3,$4)`,
    [id, JSON.stringify(media), Number(body.sort_order) || 0, activeFlag(body.is_active)],
  );
  return serializeLegacy(await one('select * from legacy_reviews where id = $1', [id]));
}

export async function updateLegacy(id, body = {}) {
  const existing = await one('select * from legacy_reviews where id = $1', [id]);
  if (!existing) throw httpError(404, 'Legacy entry not found');
  // `media` is only replaced when the request carries it, so the dashboard's
  // hide/publish and reorder actions cannot wipe an entry's gallery.
  const media = body.media === undefined ? legacyMedia(existing) : mediaList(body.media);
  if (body.media !== undefined && !media.length) throw httpError(400, 'Add at least one photo or video');
  const merged = { ...serializeLegacy(existing), ...body };
  await q(
    `update legacy_reviews set media = $2, sort_order = $3, is_active = $4 where id = $1`,
    [existing.id, JSON.stringify(media), Number(merged.sort_order) || 0, activeFlag(merged.is_active)],
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

/** Photos and videos only — no title, place or write-up is published. */
export function serializeExhibition(row) {
  if (!row) return null;
  return {
    id: row.id,
    media: exhibitionMedia(row),
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active !== false,
    created_at: row.created_at,
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
  const media = mediaList(body.media);
  if (!media.length) throw httpError(400, 'Add at least one photo or video');
  const id = newId();
  await q(
    `insert into exhibitions (id, media, sort_order, is_active)
     values ($1,$2,$3,$4)`,
    [id, JSON.stringify(media), Number(body.sort_order) || 0, activeFlag(body.is_active)],
  );
  return serializeExhibition(await one('select * from exhibitions where id = $1', [id]));
}

export async function updateExhibition(id, body = {}) {
  const existing = await one('select * from exhibitions where id = $1', [id]);
  if (!existing) throw httpError(404, 'Exhibition not found');
  const media = body.media === undefined ? exhibitionMedia(existing) : mediaList(body.media);
  if (body.media !== undefined && !media.length) throw httpError(400, 'Add at least one photo or video');
  const merged = { ...serializeExhibition(existing), ...body };
  await q(
    `update exhibitions set media = $2, sort_order = $3, is_active = $4 where id = $1`,
    [existing.id, JSON.stringify(media), Number(merged.sort_order) || 0, activeFlag(merged.is_active)],
  );
  return serializeExhibition(await one('select * from exhibitions where id = $1', [existing.id]));
}

export async function deleteExhibition(id) {
  const existing = await one('select * from exhibitions where id = $1', [id]);
  if (!existing) throw httpError(404, 'Exhibition not found');
  await q('delete from exhibitions where id = $1', [existing.id]);
  return { deleted: true };
}
