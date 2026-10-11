import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, storageMode } from '../env.js';
import { uploadsDir } from '../db.js';

let supabase;

/**
 * supabase-js wires up a Realtime client on every `createClient` call, and on a
 * runtime without a WebSocket it refuses to build the client at all — which is
 * what broke image uploads on Render, where the service runs on Node 20 (the
 * global `WebSocket` only landed in Node 22).
 *
 * Nothing here uses Realtime: uploads and deletes are plain HTTPS against
 * Storage. So hand it whatever the runtime has — the native WebSocket when it
 * exists, otherwise a placeholder that only speaks up if Realtime is ever
 * actually used.
 */
class RealtimeUnavailable {
  constructor() {
    throw new Error('Realtime needs a WebSocket implementation: run Node.js 22+ to use it.');
  }
}

async function getSupabase() {
  if (!supabase) {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
      realtime: { transport: globalThis.WebSocket ?? RealtimeUnavailable },
    });
  }
  return supabase;
}

const safeName = (name) =>
  String(name || 'image')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'image';

/**
 * Stores an uploaded image or video clip and returns its public URL.
 * Supabase Storage when keys are configured (free 1 GB tier), otherwise local
 * disk under /uploads so development needs no accounts at all.
 *
 * `folder` groups objects inside the bucket: product photos live under
 * `products/`, the Our Legacy and Exhibitions galleries under `media/`.
 */
export async function saveImage({ buffer, originalname, mimetype, folder = 'products' }) {
  const ext = (path.extname(originalname || '') || '.jpg').toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName(originalname)}${ext}`;

  if (storageMode === 'supabase') {
    const client = await getSupabase();
    const objectPath = `${folder}/${filename}`;
    const { error } = await client.storage
      .from(config.supabase.bucket)
      .upload(objectPath, buffer, { contentType: mimetype, upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    const { data } = client.storage.from(config.supabase.bucket).getPublicUrl(objectPath);
    return { url: data.publicUrl, storage: 'supabase', path: objectPath, bytes: buffer.length };
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return { url: `/uploads/${filename}`, storage: 'local', path: filename, bytes: buffer.length };
}

export async function deleteImage(imageUrl) {
  if (!imageUrl) return false;
  try {
    if (storageMode === 'supabase' && imageUrl.includes(config.supabase.url)) {
      const marker = `/${config.supabase.bucket}/`;
      const index = imageUrl.indexOf(marker);
      if (index === -1) return false;
      const objectPath = decodeURIComponent(imageUrl.slice(index + marker.length));
      const client = await getSupabase();
      const { error } = await client.storage.from(config.supabase.bucket).remove([objectPath]);
      return !error;
    }
    if (imageUrl.startsWith('/uploads/')) {
      await fs.unlink(path.join(uploadsDir, path.basename(imageUrl)));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export { storageMode };
