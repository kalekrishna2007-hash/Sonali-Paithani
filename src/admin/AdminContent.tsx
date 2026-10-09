import { useState } from 'react';
import { adminApi } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import type { Exhibition, LegacyReview } from '../lib/types';
import { CloseIcon, EditIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/icons';

/**
 * One upload control for every image field on this screen. Files go through the
 * same /api/admin/uploads route the product form uses, so storage (Supabase or
 * local /uploads) is decided in one place.
 */
function UploadButton({ onUploaded, label = 'Upload image' }: { onUploaded: (urls: string[]) => void; label?: string }) {
  const { notify } = useApp();
  const [uploading, setUploading] = useState(false);

  return (
    <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer' }}>
      <UploadIcon size={15} /> {uploading ? 'Uploading…' : label}
      <input
        type="file"
        accept="image/*"
        multiple
        hidden
        disabled={uploading}
        onChange={async (event) => {
          const files = event.target.files;
          if (!files?.length) return;
          setUploading(true);
          try {
            const result = await adminApi.upload(files);
            onUploaded(result.urls);
            notify(`${result.urls.length} image${result.urls.length > 1 ? 's' : ''} uploaded`, 'success');
          } catch (error) {
            notify(error instanceof Error ? error.message : 'Upload failed', 'error');
          } finally {
            setUploading(false);
            event.target.value = '';
          }
        }}
      />
    </label>
  );
}

/* ─── Our Legacy ───────────────────────────────────────────────────────── */

export function AdminLegacy() {
  const { notify } = useApp();
  const [editing, setEditing] = useState<LegacyReview | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useAsync(() => adminApi.legacy(), []);
  const entries = data?.legacy || [];

  const toggle = async (entry: LegacyReview) => {
    try {
      await adminApi.updateLegacy(entry.id, { is_active: !entry.is_active });
      notify(entry.is_active ? `${entry.celebrity_name} hidden from the site` : `${entry.celebrity_name} is live`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update', 'error');
    }
  };

  const remove = async (entry: LegacyReview) => {
    if (!window.confirm(`Delete the ${entry.celebrity_name} entry? This cannot be undone.`)) return;
    try {
      await adminApi.deleteLegacy(entry.id);
      notify('Entry deleted', 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
  };

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">Our Legacy</span>
          <h1>Personalities &amp; reviews</h1>
        </div>
        <button className="btn btn--sm" onClick={() => setCreating(true)}>
          <PlusIcon size={14} /> Add personality
        </button>
      </div>

      <p className="help" style={{ marginBottom: '1.2rem' }}>
        Add a photo of a personality wearing a Paithani along with their review. Everything here appears on the
        storefront <strong>Our Legacy</strong> page, in the order set below.
      </p>

      {loading && <div className="skeleton" style={{ height: '220px' }} />}

      {!loading && !entries.length && (
        <div className="empty">
          <h3>No personalities yet</h3>
          <p className="muted">Add the first photograph and review to start the Our Legacy page.</p>
          <button className="btn" onClick={() => setCreating(true)}>Add personality</button>
        </div>
      )}

      <div className="legacy-admin">
        {entries.map((entry) => (
          <div className="card" key={entry.id}>
            <div className="row" style={{ gap: '1rem', alignItems: 'flex-start' }}>
              <img
                className="thumb"
                style={{ width: '72px', height: '90px' }}
                src={entry.image_url || '/images/paithani-1.svg'}
                alt=""
              />
              <div style={{ minWidth: 0 }}>
                <div className="row row--wrap" style={{ gap: '0.4rem' }}>
                  <strong>{entry.celebrity_name}</strong>
                  <span className={`badge badge--${entry.is_active ? 'approved' : 'muted'}`}>
                    {entry.is_active ? 'live' : 'hidden'}
                  </span>
                  <span className="badge badge--muted">#{entry.sort_order}</span>
                </div>
                {entry.title && <div className="muted small">{entry.title}</div>}
                {entry.review && (
                  <p className="muted small" style={{ margin: '0.4rem 0 0' }}>
                    {entry.review.length > 160 ? `${entry.review.slice(0, 160)}…` : entry.review}
                  </p>
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
        <LegacyForm
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

function LegacyForm({ entry, onClose, onSaved }: { entry: LegacyReview | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const [form, setForm] = useState({
    celebrity_name: entry?.celebrity_name || '',
    title: entry?.title || '',
    review: entry?.review || '',
    sort_order: entry?.sort_order ?? 0,
    is_active: entry?.is_active ?? true,
  });
  const [imageUrl, setImageUrl] = useState(entry?.image_url || '');
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.celebrity_name.trim().length < 2) return setError('Add the name of the personality');
    setSaving(true);
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0, image_url: imageUrl || null };
      if (entry) await adminApi.updateLegacy(entry.id, payload);
      else await adminApi.createLegacy(payload);
      notify(entry ? 'Entry updated' : 'Entry added', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="dialog__scrim" aria-label="Close" onClick={onClose} />
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-label={entry ? 'Edit entry' : 'Add entry'}>
        <form onSubmit={save}>
          <div className="dialog__head">
            <div>
              <span className="eyebrow">{entry ? 'Edit' : 'New'} legacy entry</span>
              <h3>{entry ? entry.celebrity_name : 'Add a personality and their review'}</h3>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="dialog__body">
            <div className="form-grid">
              <label className="field">
                <span>Name *</span>
                <input
                  className="input"
                  value={form.celebrity_name}
                  onChange={(event) => setForm({ ...form, celebrity_name: event.target.value })}
                  placeholder="Actor / dancer / presenter"
                  required
                />
              </label>
              <label className="field">
                <span>Title or role</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Actor · Marathi cinema"
                />
              </label>
              <label className="field field--full">
                <span>Review / what they said</span>
                <textarea
                  className="textarea"
                  value={form.review}
                  onChange={(event) => setForm({ ...form, review: event.target.value })}
                  placeholder="I wore the peacock munni for our anniversary shoot…"
                />
              </label>
            </div>

            <div style={{ marginTop: '1.4rem' }}>
              <span className="eyebrow">Photograph</span>
              <div className="row row--wrap" style={{ marginBottom: '0.8rem' }}>
                <UploadButton onUploaded={(urls) => setImageUrl(urls[0])} label="Upload photo" />
                <input
                  className="input"
                  style={{ flex: 1, minWidth: '200px' }}
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  placeholder="…or paste an image URL"
                />
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    if (!pasted.trim()) return;
                    setImageUrl(pasted.trim());
                    setPasted('');
                  }}
                >
                  Use URL
                </button>
              </div>
              {imageUrl ? (
                <div style={{ position: 'relative', width: '120px' }}>
                  <img className="thumb" style={{ width: '120px', height: '150px' }} src={imageUrl} alt="" />
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 999 }}
                    onClick={() => setImageUrl('')}
                    aria-label="Remove photo"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ) : (
                <p className="help">No photograph yet — the storefront will use a saree image as a fallback.</p>
              )}
            </div>

            <div className="row row--wrap" style={{ marginTop: '1.4rem', gap: '1.4rem' }}>
              <label className="field">
                <span>Display order</span>
                <input
                  className="input"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
                />
              </label>
              <label className="row" style={{ gap: '0.4rem', alignSelf: 'end' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                <span className="small">Show on the storefront</span>
              </label>
            </div>

            {error && <p className="field__error" style={{ marginTop: '1rem' }}>{error}</p>}
          </div>

          <div className="dialog__foot">
            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : entry ? 'Save changes' : 'Add entry'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ─── Exhibitions ──────────────────────────────────────────────────────── */

export function AdminExhibitions() {
  const { notify } = useApp();
  const [editing, setEditing] = useState<Exhibition | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useAsync(() => adminApi.exhibitions(), []);
  const shows = data?.exhibitions || [];

  const toggle = async (show: Exhibition) => {
    try {
      await adminApi.updateExhibition(show.id, { is_active: !show.is_active });
      notify(show.is_active ? `${show.title} hidden from the site` : `${show.title} is live`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update', 'error');
    }
  };

  const remove = async (show: Exhibition) => {
    if (!window.confirm(`Delete "${show.title}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteExhibition(show.id);
      notify('Exhibition deleted', 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
  };

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">Exhibitions</span>
          <h1>Shows &amp; expos</h1>
        </div>
        <button className="btn btn--sm" onClick={() => setCreating(true)}>
          <PlusIcon size={14} /> Add exhibition
        </button>
      </div>

      <p className="help" style={{ marginBottom: '1.2rem' }}>
        Record every exhibition with its title, location, date, a short description and photographs. Published entries
        appear on the storefront <strong>Exhibitions</strong> page.
      </p>

      {loading && <div className="skeleton" style={{ height: '220px' }} />}

      {!loading && !shows.length && (
        <div className="empty">
          <h3>No exhibitions yet</h3>
          <p className="muted">Add your first exhibition to start this page.</p>
          <button className="btn" onClick={() => setCreating(true)}>Add exhibition</button>
        </div>
      )}

      {shows.map((show) => (
        <div className="card" key={show.id}>
          <div className="row row--wrap" style={{ gap: '1rem', alignItems: 'flex-start' }}>
            <div className="row" style={{ gap: '0.4rem' }}>
              {(show.images.length ? show.images : ['/images/paithani-1.svg']).slice(0, 3).map((image, index) => (
                <img key={`${show.id}-${index}`} className="thumb" style={{ width: '60px', height: '76px' }} src={image} alt="" />
              ))}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="row row--wrap" style={{ gap: '0.4rem' }}>
                <strong>{show.title}</strong>
                <span className={`badge badge--${show.is_active ? 'approved' : 'muted'}`}>
                  {show.is_active ? 'live' : 'hidden'}
                </span>
                <span className="badge badge--muted">#{show.sort_order}</span>
              </div>
              <div className="muted small">
                {[show.location, show.event_date].filter(Boolean).join(' · ') || 'No location set'}
              </div>
              {show.description && (
                <p className="muted small" style={{ margin: '0.4rem 0 0' }}>
                  {show.description.length > 180 ? `${show.description.slice(0, 180)}…` : show.description}
                </p>
              )}
            </div>
            <div className="table-actions" style={{ marginLeft: 'auto' }}>
              <button className="btn btn--outline btn--sm" onClick={() => setEditing(show)}>
                <EditIcon size={13} /> Edit
              </button>
              <button className="btn btn--outline btn--sm" onClick={() => toggle(show)}>
                {show.is_active ? 'Hide' : 'Publish'}
              </button>
              <button className="btn btn--danger btn--sm" onClick={() => remove(show)}>
                <TrashIcon size={13} /> Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {(creating || editing) && (
        <ExhibitionForm
          exhibition={editing}
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

function ExhibitionForm({ exhibition, onClose, onSaved }: { exhibition: Exhibition | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const [form, setForm] = useState({
    title: exhibition?.title || '',
    location: exhibition?.location || '',
    event_date: exhibition?.event_date || '',
    description: exhibition?.description || '',
    sort_order: exhibition?.sort_order ?? 0,
    is_active: exhibition?.is_active ?? true,
  });
  const [images, setImages] = useState<string[]>(exhibition?.images || []);
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const move = (index: number, direction: -1 | 1) => {
    setImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.title.trim().length < 2) return setError('Give the exhibition a title');
    setSaving(true);
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0, images };
      if (exhibition) await adminApi.updateExhibition(exhibition.id, payload);
      else await adminApi.createExhibition(payload);
      notify(exhibition ? 'Exhibition updated' : 'Exhibition added', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the exhibition');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="dialog__scrim" aria-label="Close" onClick={onClose} />
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-label={exhibition ? 'Edit exhibition' : 'Add exhibition'}>
        <form onSubmit={save}>
          <div className="dialog__head">
            <div>
              <span className="eyebrow">{exhibition ? 'Edit' : 'New'} exhibition</span>
              <h3>{exhibition ? exhibition.title : 'Add an exhibition'}</h3>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="dialog__body">
            <div className="form-grid">
              <label className="field field--full">
                <span>Title *</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Yeola Handloom Utsav"
                  required
                />
              </label>
              <label className="field">
                <span>Location</span>
                <input
                  className="input"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Yeola, Nashik"
                />
              </label>
              <label className="field">
                <span>Date or period</span>
                <input
                  className="input"
                  value={form.event_date}
                  onChange={(event) => setForm({ ...form, event_date: event.target.value })}
                  placeholder="February 2026"
                />
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea
                  className="textarea"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Ten days on the loom-front at the town that gave Paithani its name…"
                />
              </label>
            </div>

            <div style={{ marginTop: '1.4rem' }}>
              <span className="eyebrow">Photographs</span>
              <p className="help">First photo is the cover. Up to three are shown together on the storefront.</p>

              <div className="row row--wrap" style={{ marginBottom: '0.8rem' }}>
                <UploadButton onUploaded={(urls) => setImages((current) => [...current, ...urls])} label="Upload photos" />
                <input
                  className="input"
                  style={{ flex: 1, minWidth: '200px' }}
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  placeholder="…or paste an image URL"
                />
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    if (!pasted.trim()) return;
                    setImages((current) => [...current, pasted.trim()]);
                    setPasted('');
                  }}
                >
                  Add URL
                </button>
              </div>

              {images.length ? (
                <div className="row row--wrap" style={{ gap: '0.7rem' }}>
                  {images.map((image, index) => (
                    <div key={`${image}-${index}`} style={{ position: 'relative', width: '92px' }}>
                      <img className="thumb" style={{ width: '92px', height: '116px' }} src={image} alt="" />
                      {index === 0 && <span className="badge badge--muted" style={{ position: 'absolute', top: 4, left: 4 }}>cover</span>}
                      <div className="row" style={{ gap: '0.2rem', marginTop: '0.3rem' }}>
                        <button type="button" className="icon-btn" onClick={() => move(index, -1)} aria-label="Move left">←</button>
                        <button type="button" className="icon-btn" onClick={() => move(index, 1)} aria-label="Move right">→</button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setImages((current) => current.filter((_, position) => position !== index))}
                          aria-label="Remove photo"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="help">No photographs yet — add at least one before publishing.</p>
              )}
            </div>

            <div className="row row--wrap" style={{ marginTop: '1.4rem', gap: '1.4rem' }}>
              <label className="field">
                <span>Display order</span>
                <input
                  className="input"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
                />
              </label>
              <label className="row" style={{ gap: '0.4rem', alignSelf: 'end' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                <span className="small">Show on the storefront</span>
              </label>
            </div>

            {error && <p className="field__error" style={{ marginTop: '1rem' }}>{error}</p>}
          </div>

          <div className="dialog__foot">
            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : exhibition ? 'Save changes' : 'Add exhibition'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
