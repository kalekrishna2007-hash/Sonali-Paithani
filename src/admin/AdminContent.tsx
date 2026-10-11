import { useState } from 'react';
import { adminApi } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import type { Exhibition, LegacyEntry } from '../lib/types';
import { MediaThumb } from '../components/MediaGallery';
import { CloseIcon, EditIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/icons';

/** How many photos and clips one gallery set can hold. Kept in step with the
 *  server-side cap in services/content.js. */
const MAX_MEDIA = 24;

type GalleryEntry = LegacyEntry | Exhibition;
type GallerySection = 'legacy' | 'exhibitions';

type GalleryEndpoints = {
  list: () => Promise<GalleryEntry[]>;
  create: (body: Partial<GalleryEntry>) => Promise<unknown>;
  update: (id: string, body: Partial<GalleryEntry>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
};

/**
 * Both storefront galleries are media-only, so they share one screen. The only
 * difference is the wording and which endpoint pair is called.
 */
const COPY: Record<GallerySection, {
  eyebrow: string;
  heading: string;
  help: string;
  empty: string;
  add: string;
  newLabel: string;
}> = {
  legacy: {
    eyebrow: 'Our Legacy',
    heading: 'Photos & videos',
    help:
      'Upload photographs and video clips of personalities wearing a Paithani. Only the media is published — no name, role or quote is ever collected or shown.',
    empty: 'Add the first photos or clips that should appear on the Our Legacy page.',
    add: 'Add photos & videos',
    newLabel: 'New legacy set',
  },
  exhibitions: {
    eyebrow: 'Exhibitions',
    heading: 'Photos & videos',
    help:
      'Upload photographs and video clips from exhibitions, expos and pop-ups. Only the media is published — no title, place or write-up is attached.',
    empty: 'Add the first photos or clips that should appear on the Exhibitions page.',
    add: 'Add photos & videos',
    newLabel: 'New exhibition set',
  },
};

const ENDPOINTS: Record<GallerySection, GalleryEndpoints> = {
  legacy: {
    list: async () => (await adminApi.legacy()).legacy,
    create: (body) => adminApi.createLegacy(body),
    update: (id, body) => adminApi.updateLegacy(id, body),
    remove: (id) => adminApi.deleteLegacy(id),
  },
  exhibitions: {
    list: async () => (await adminApi.exhibitions()).exhibitions,
    create: (body) => adminApi.createExhibition(body),
    update: (id, body) => adminApi.updateExhibition(id, body),
    remove: (id) => adminApi.deleteExhibition(id),
  },
};

/**
 * Uploads the chosen files and returns the URLs to keep.
 *
 * Photos go up in one batch through the image route; video clips go one file per
 * request, because the server buffers an upload in memory before storing it and
 * a dozen clips at once would multiply that buffer.
 */
async function uploadSelection(files: FileList | File[]) {
  const all = Array.from(files);
  const photos = all.filter((file) => !file.type.startsWith('video/'));
  const videos = all.filter((file) => file.type.startsWith('video/'));
  const urls: string[] = [];
  // The image route takes at most twelve files per request.
  for (let index = 0; index < photos.length; index += 12) {
    urls.push(...(await adminApi.upload(photos.slice(index, index + 12))).urls);
  }
  for (const video of videos) urls.push((await adminApi.uploadMedia(video)).url);
  return urls;
}

export function AdminLegacy() {
  return <AdminGallery section="legacy" />;
}

export function AdminExhibitions() {
  return <AdminGallery section="exhibitions" />;
}

function AdminGallery({ section }: { section: GallerySection }) {
  const { notify } = useApp();
  const copy = COPY[section];
  const endpoints = ENDPOINTS[section];
  const [editing, setEditing] = useState<GalleryEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useAsync(() => endpoints.list(), [section]);
  const entries = data || [];

  const countLabel = (entry: GalleryEntry) =>
    `${entry.media.length} photo${entry.media.length === 1 ? '' : 's'}/clip${entry.media.length === 1 ? '' : 's'}`;

  const toggle = async (entry: GalleryEntry) => {
    try {
      await endpoints.update(entry.id, { is_active: !entry.is_active });
      notify(entry.is_active ? 'Set hidden from the site' : 'Set is live', 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update', 'error');
    }
  };

  const remove = async (entry: GalleryEntry) => {
    if (!window.confirm(`Delete these ${countLabel(entry)}? This cannot be undone.`)) return;
    try {
      await endpoints.remove(entry.id);
      notify('Set deleted', 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
  };

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.heading}</h1>
        </div>
        <button className="btn btn--sm" onClick={() => setCreating(true)}>
          <PlusIcon size={14} /> {copy.add}
        </button>
      </div>

      <p className="help" style={{ marginBottom: '1.2rem' }}>
        {copy.help} Everything here appears on the storefront <strong>{copy.eyebrow}</strong> page, in the order set
        below.
      </p>

      {loading && <div className="skeleton" style={{ height: '220px' }} />}

      {!loading && !entries.length && (
        <div className="empty">
          <h3>Nothing uploaded yet</h3>
          <p className="muted">{copy.empty}</p>
          <button className="btn" onClick={() => setCreating(true)}>
            {copy.add}
          </button>
        </div>
      )}

      <div className="legacy-admin">
        {entries.map((entry) => (
          <div className="card" key={entry.id}>
            <div className="row row--wrap" style={{ gap: '1rem', alignItems: 'flex-start' }}>
              <div className="row" style={{ gap: '0.4rem' }}>
                {(entry.media.length ? entry.media : ['/images/paithani-1.svg'])
                  .slice(0, 3)
                  .map((url, index) => (
                    <MediaThumb
                      key={`${entry.id}-${index}`}
                      url={url}
                      className="thumb"
                      style={{ width: '68px', height: '86px' }}
                    />
                  ))}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row row--wrap" style={{ gap: '0.4rem' }}>
                  <strong>{countLabel(entry)}</strong>
                  <span className={`badge badge--${entry.is_active ? 'approved' : 'muted'}`}>
                    {entry.is_active ? 'live' : 'hidden'}
                  </span>
                  <span className="badge badge--muted">#{entry.sort_order}</span>
                </div>
                {entry.media.length > 3 && (
                  <div className="muted small">and {entry.media.length - 3} more</div>
                )}
              </div>
              <div className="table-actions" style={{ marginLeft: 'auto' }}>
                <button className="btn btn--outline btn--sm" onClick={() => setEditing(entry)}>
                  <EditIcon size={13} /> Edit
                </button>
                <button className="btn btn--outline btn--sm" onClick={() => toggle(entry)}>
                  {entry.is_active ? 'Hide' : 'Publish'}
                </button>
                <button className="btn btn--danger btn--sm" onClick={() => remove(entry)}>
                  <TrashIcon size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <GalleryForm
          section={section}
          entry={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function GalleryForm({
  section,
  entry,
  onClose,
  onSaved,
}: {
  section: GallerySection;
  entry: GalleryEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useApp();
  const copy = COPY[section];
  const endpoints = ENDPOINTS[section];
  const [media, setMedia] = useState<string[]>(entry?.media || []);
  const [sortOrder, setSortOrder] = useState(entry?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(entry?.is_active ?? true);
  const [pasted, setPasted] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const move = (index: number, direction: -1 | 1) => {
    setMedia((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    try {
      const urls = await uploadSelection(files);
      setMedia((current) => [...current, ...urls].slice(0, MAX_MEDIA));
      notify(`${urls.length} file${urls.length === 1 ? '' : 's'} uploaded`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!media.length) return setError('Add at least one photo or video');
    setSaving(true);
    try {
      const payload = { media, sort_order: Number(sortOrder) || 0, is_active: isActive };
      if (entry) await endpoints.update(entry.id, payload);
      else await endpoints.create(payload);
      notify(entry ? 'Set updated' : 'Set added', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="dialog__scrim" aria-label="Close" onClick={onClose} />
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-label={entry ? 'Edit set' : 'Add set'}>
        <form onSubmit={save}>
          <div className="dialog__head">
            <div>
              <span className="eyebrow">{entry ? 'Edit' : copy.newLabel}</span>
              <h3>{copy.add}</h3>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="dialog__body">
            <span className="eyebrow">Photos &amp; videos</span>
            <p className="help">
              Photos up to 8 MB, video clips up to 48 MB. Up to {MAX_MEDIA} items per set; they appear on the
              storefront in the order below.
            </p>

            <div className="row row--wrap" style={{ marginBottom: '0.8rem' }}>
              <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer' }}>
                <UploadIcon size={15} /> {uploading ? 'Uploading…' : 'Upload photos & videos'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  disabled={uploading}
                  onChange={(event) => pickFiles(event.target.files)}
                />
              </label>
              <input
                className="input"
                style={{ flex: 1, minWidth: '200px' }}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                placeholder="…or paste a photo or video URL"
              />
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  if (!pasted.trim()) return;
                  setMedia((current) => [...current, pasted.trim()].slice(0, MAX_MEDIA));
                  setPasted('');
                }}
              >
                Add URL
              </button>
            </div>

            {media.length ? (
              <div className="row row--wrap" style={{ gap: '0.7rem' }}>
                {media.map((url, index) => (
                  <div key={`${url}-${index}`} style={{ position: 'relative', width: '92px' }}>
                    <MediaThumb url={url} className="thumb" style={{ width: '92px', height: '116px' }} />
                    <div className="row" style={{ gap: '0.2rem', marginTop: '0.3rem' }}>
                      <button type="button" className="icon-btn" onClick={() => move(index, -1)} aria-label="Move left">
                        ←
                      </button>
                      <button type="button" className="icon-btn" onClick={() => move(index, 1)} aria-label="Move right">
                        →
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setMedia((current) => current.filter((_, position) => position !== index))}
                        aria-label="Remove"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="help">Nothing added yet — at least one photo or video is needed before publishing.</p>
            )}

            <div className="row row--wrap" style={{ marginTop: '1.4rem', gap: '1.4rem' }}>
              <label className="field">
                <span>Display order</span>
                <input
                  className="input"
                  type="number"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(Number(event.target.value))}
                />
              </label>
              <label className="row" style={{ gap: '0.4rem', alignSelf: 'end' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                <span className="small">Show on the storefront</span>
              </label>
            </div>

            {error && <p className="field__error" style={{ marginTop: '1rem' }}>{error}</p>}
          </div>

          <div className="dialog__foot">
            <button type="button" className="btn btn--outline" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" type="submit" disabled={saving || uploading}>
              {saving ? 'Saving…' : entry ? 'Save changes' : 'Add to gallery'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
