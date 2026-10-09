import { useState } from 'react';
import { adminApi } from '../lib/api';
import { useApp } from '../lib/store';
import type { Collection, Product } from '../lib/types';
import { CloseIcon, TrashIcon, UploadIcon } from '../components/icons';

interface Props {
  product: Product | null;
  collections: Collection[];
  onClose: () => void;
  onSaved: () => void;
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function ProductForm({ product, collections, onClose, onSaved }: Props) {
  const { notify } = useApp();
  const [form, setForm] = useState({
    name: product?.name || '',
    slug: product?.slug || '',
    sku: product?.sku || '',
    collection_slug: product?.collection_slug || collections[0]?.slug || '',
    occasion: product?.occasion || '',
    range_label: product?.range_label || '',
    price: product?.price ?? 0,
    compare_at_price: product?.compare_at_price ?? '',
    short_description: product?.short_description || '',
    description: product?.description || '',
    fabric: product?.fabric || '',
    weave: product?.weave || '',
    work: product?.work || '',
    care: product?.care || '',
    dimensions: product?.dimensions || '',
    stock: product?.stock ?? 0,
    low_stock_threshold: product?.low_stock_threshold ?? 2,
    sizes: (product?.sizes || ['6.3 M with Blouse', '5.5 M without Blouse']).join(', '),
    colors: (product?.colors || []).join(', '),
    tags: (product?.tags || []).join(', '),
    is_featured: product?.is_featured ?? false,
    is_best_seller: product?.is_best_seller ?? false,
    is_new_arrival: product?.is_new_arrival ?? true,
    is_active: product?.is_active ?? true,
  });
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const result = await adminApi.upload(files);
      setImages((current) => [...current, ...result.urls]);
      notify(`${result.urls.length} image${result.urls.length > 1 ? 's' : ''} uploaded`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

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
    if (form.name.trim().length < 3) return setError('Please give the saree a name');
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug.trim() || undefined,
        compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        sizes: splitList(form.sizes),
        colors: splitList(form.colors),
        tags: splitList(form.tags),
        images,
      };
      if (product) await adminApi.updateProduct(product.id, payload);
      else await adminApi.createProduct(payload);
      notify(product ? 'Product updated' : 'Product added to the catalogue', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="dialog__scrim" aria-label="Close" onClick={onClose} />
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-label={product ? 'Edit product' : 'Add product'}>
        <form onSubmit={save}>
          <div className="dialog__head">
            <div>
              <span className="eyebrow">{product ? 'Edit saree' : 'New saree'}</span>
              <h3>{product ? product.name : 'Add a product to the catalogue'}</h3>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="dialog__body">
            <div className="form-grid">
              <label className="field field--full">
                <span>Name *</span>
                <input className="input" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Peacock Munni Paithani" required />
              </label>

              <label className="field">
                <span>Collection</span>
                <select className="select" value={form.collection_slug} onChange={(event) => set('collection_slug', event.target.value)}>
                  <option value="">Unassigned</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.slug}>{collection.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Occasion</span>
                <input className="input" value={form.occasion} onChange={(event) => set('occasion', event.target.value)} placeholder="Bridal / Festive / Party" list="occasion-options" />
                <datalist id="occasion-options">
                  <option value="Bridal" /><option value="Festive" /><option value="Party" /><option value="Daily Wear" /><option value="Gifting" />
                </datalist>
              </label>
              <label className="field">
                <span>Range</span>
                <input className="input" value={form.range_label} onChange={(event) => set('range_label', event.target.value)} placeholder="Heritage / Signature / Classic" />
              </label>
              <label className="field">
                <span>SKU / loom code</span>
                <input className="input" value={form.sku} onChange={(event) => set('sku', event.target.value)} placeholder="SP-2026-014" />
              </label>

              <label className="field">
                <span>Price (₹) *</span>
                <input className="input" type="number" min={0} value={form.price} onChange={(event) => set('price', Number(event.target.value))} required />
              </label>
              <label className="field">
                <span>Compare-at price (₹)</span>
                <input className="input" type="number" min={0} value={form.compare_at_price as number | string} onChange={(event) => set('compare_at_price', event.target.value === '' ? '' : Number(event.target.value))} placeholder="Optional" />
              </label>

              <label className="field">
                <span>Pieces in stock</span>
                <input className="input" type="number" value={form.stock} onChange={(event) => set('stock', Number(event.target.value))} />
                <span className="help">0 means “made to order”. Use the stock panel for later adjustments.</span>
              </label>
              <label className="field">
                <span>Low stock alert at</span>
                <input className="input" type="number" min={0} value={form.low_stock_threshold} onChange={(event) => set('low_stock_threshold', Number(event.target.value))} />
              </label>

              <label className="field field--full">
                <span>Short description</span>
                <input className="input" value={form.short_description} onChange={(event) => set('short_description', event.target.value)} placeholder="Peacock munni pallu with tested gold zari." />
              </label>
              <label className="field field--full">
                <span>Full description</span>
                <textarea className="textarea" value={form.description} onChange={(event) => set('description', event.target.value)} />
              </label>

              <label className="field"><span>Fabric</span><input className="input" value={form.fabric} onChange={(event) => set('fabric', event.target.value)} /></label>
              <label className="field"><span>Weave</span><input className="input" value={form.weave} onChange={(event) => set('weave', event.target.value)} /></label>
              <label className="field"><span>Work / motif</span><input className="input" value={form.work} onChange={(event) => set('work', event.target.value)} /></label>
              <label className="field"><span>Care</span><input className="input" value={form.care} onChange={(event) => set('care', event.target.value)} /></label>
              <label className="field field--full"><span>Dimensions</span><input className="input" value={form.dimensions} onChange={(event) => set('dimensions', event.target.value)} placeholder="Saree 6.30 m x 1.16 m, Blouse 0.80 m" /></label>

              <label className="field field--full">
                <span>Sizes (comma separated)</span>
                <input className="input" value={form.sizes} onChange={(event) => set('sizes', event.target.value)} />
              </label>
              <label className="field field--full">
                <span>Colours (comma separated)</span>
                <input className="input" value={form.colors} onChange={(event) => set('colors', event.target.value)} placeholder="Peacock Green, Maroon" />
              </label>
              <label className="field field--full">
                <span>Tags (comma separated)</span>
                <input className="input" value={form.tags} onChange={(event) => set('tags', event.target.value)} placeholder="bridal, peacock, heirloom" />
              </label>
            </div>

            <div style={{ marginTop: '1.6rem' }}>
              <span className="eyebrow">Images</span>
              <p className="help">
                First image is the cover. JPEG, PNG, WEBP or AVIF up to 8 MB each — stored in
                {' '}{'Supabase Storage'} when configured, otherwise in <code>/uploads</code>.
              </p>

              <div className="row row--wrap" style={{ marginBottom: '0.8rem' }}>
                <label className="btn btn--outline btn--sm" style={{ cursor: 'pointer' }}>
                  <UploadIcon size={15} /> {uploading ? 'Uploading…' : 'Upload images'}
                  <input type="file" accept="image/*" multiple hidden onChange={(event) => upload(event.target.files)} disabled={uploading} />
                </label>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: '220px' }}
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="…or paste an image URL"
                />
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    if (!imageUrl.trim()) return;
                    setImages((current) => [...current, imageUrl.trim()]);
                    setImageUrl('');
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
                          aria-label="Remove image"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="help">No images yet — add at least one before publishing.</p>
              )}
            </div>

            <div className="row row--wrap" style={{ marginTop: '1.6rem', gap: '1.4rem' }}>
              <label className="row" style={{ gap: '0.4rem' }}>
                <input type="checkbox" checked={form.is_active} onChange={(event) => set('is_active', event.target.checked)} />
                <span className="small">Visible on the storefront</span>
              </label>
              <label className="row" style={{ gap: '0.4rem' }}>
                <input type="checkbox" checked={form.is_featured} onChange={(event) => set('is_featured', event.target.checked)} />
                <span className="small">Featured on home</span>
              </label>
              <label className="row" style={{ gap: '0.4rem' }}>
                <input type="checkbox" checked={form.is_best_seller} onChange={(event) => set('is_best_seller', event.target.checked)} />
                <span className="small">Best seller</span>
              </label>
              <label className="row" style={{ gap: '0.4rem' }}>
                <input type="checkbox" checked={form.is_new_arrival} onChange={(event) => set('is_new_arrival', event.target.checked)} />
                <span className="small">New arrival</span>
              </label>
            </div>

            {error && <p className="field__error" style={{ marginTop: '1rem' }}>{error}</p>}
          </div>

          <div className="dialog__foot">
            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
