import { useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import { formatDateTime, inrRaw } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import type { Product } from '../lib/types';
import { ProductForm } from './ProductForm';
import { CloseIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons';

type StatusFilter = 'all' | 'active' | 'hidden' | 'out_of_stock' | 'oversold' | 'deleted';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All live' },
  { value: 'active', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'out_of_stock', label: 'Made to order' },
  { value: 'oversold', label: 'Oversold' },
  { value: 'deleted', label: 'Removed' },
];

export function AdminProducts() {
  const { notify } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockFor, setStockFor] = useState<Product | null>(null);

  const params = useMemo(
    () => ({
      q: search || undefined,
      include_deleted: filter === 'deleted' || filter === 'all',
      limit: 200,
    }),
    [search, filter],
  );

  const { data, loading, reload } = useAsync(() => adminApi.products(params), [JSON.stringify(params)]);
  const { data: collectionData } = useAsync(() => adminApi.collections(), []);
  const collections = collectionData?.collections || [];

  const rows = (data?.rows || []).filter((product) => {
    if (filter === 'deleted') return product.is_deleted;
    if (product.is_deleted) return false;
    if (filter === 'active') return product.is_active;
    if (filter === 'hidden') return !product.is_active;
    if (filter === 'out_of_stock') return product.stock <= 0;
    if (filter === 'oversold') return product.stock < 0;
    return true;
  });

  const toggleVisibility = async (product: Product) => {
    try {
      await adminApi.updateProduct(product.id, { is_active: !product.is_active });
      notify(product.is_active ? `${product.name} hidden from storefront` : `${product.name} is live again`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update', 'error');
    }
  };

  const remove = async (product: Product) => {
    if (!window.confirm(`Remove "${product.name}" from the storefront? Past enquiries keep their history.`)) return;
    try {
      await adminApi.deleteProduct(product.id);
      notify(`${product.name} removed`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not remove', 'error');
    }
  };

  const restore = async (product: Product) => {
    try {
      await adminApi.restoreProduct(product.id);
      notify(`${product.name} restored`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not restore', 'error');
    }
  };

  const quickStock = async (product: Product, delta: number) => {
    try {
      const result = await adminApi.adjustStock(product.id, { delta, reason: 'quick-adjust' });
      notify(`${product.name}: ${result.change.balance} in stock`, 'success');
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update stock', 'error');
    }
  };

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>Products &amp; stock</h1>
        </div>
        <div className="row row--wrap">
          <input
            className="input"
            style={{ minWidth: '200px' }}
            placeholder="Search by name or tag"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="select" value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
            {FILTERS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={() => setCreating(true)}>
            <PlusIcon size={14} /> Add product
          </button>
        </div>
      </div>

      <div className="row row--wrap" style={{ marginBottom: '1rem' }}>
        <span className="badge badge--muted">{rows.length} listed</span>
        {loading && <span className="badge badge--muted">loading…</span>}
        <span className="help">
          Stock counts are live — approving an enquiry subtracts the pieces automatically.
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Saree</th>
              <th>Collection</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="row" style={{ gap: '0.8rem' }}>
                    <img className="thumb" src={product.images[0] || '/images/paithani-1.svg'} alt="" />
                    <div>
                      <strong>{product.name}</strong>
                      <div className="muted small">{product.sku || product.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="small">{(product.collection_slug || '—').replace(/-/g, ' ')}</td>
                <td>{inrRaw(product.price)}</td>
                <td>
                  <div className="row" style={{ gap: '0.3rem' }}>
                    <button className="icon-btn" onClick={() => quickStock(product, -1)} aria-label="Decrease stock">−</button>
                    <span className={`badge badge--${product.stock < 0 ? 'rejected' : product.stock === 0 ? 'muted' : product.stock <= product.low_stock_threshold ? 'warn' : 'approved'}`}>
                      {product.stock}
                    </span>
                    <button className="icon-btn" onClick={() => quickStock(product, 1)} aria-label="Increase stock">+</button>
                    <button className="btn btn--quiet btn--sm" onClick={() => setStockFor(product)}>set</button>
                  </div>
                </td>
                <td>
                  <div className="row row--wrap" style={{ gap: '0.3rem' }}>
                    {product.is_deleted ? (
                      <span className="badge badge--cancelled">removed</span>
                    ) : product.is_active ? (
                      <span className="badge badge--approved">live</span>
                    ) : (
                      <span className="badge badge--muted">hidden</span>
                    )}
                    {product.is_featured && <span className="badge badge--pending">featured</span>}
                    {product.is_new_arrival && <span className="badge badge--completed">new</span>}
                  </div>
                </td>
                <td className="small muted">{formatDateTime(product.updated_at)}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn--outline btn--sm" onClick={() => setEditing(product)}>
                      <EditIcon size={13} /> Edit
                    </button>
                    {product.is_deleted ? (
                      <button className="btn btn--outline btn--sm" onClick={() => restore(product)}>Restore</button>
                    ) : (
                      <>
                        <button className="btn btn--outline btn--sm" onClick={() => toggleVisibility(product)}>
                          {product.is_active ? 'Hide' : 'Publish'}
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={() => remove(product)}>
                          <TrashIcon size={13} /> Remove
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && !loading && (
        <div className="empty" style={{ marginTop: '1rem' }}>
          <h3>No products in this view</h3>
          <p className="muted">Try another filter, or add your first saree to the catalogue.</p>
          <button className="btn" onClick={() => setCreating(true)}>Add product</button>
        </div>
      )}

      {(creating || editing) && (
        <ProductForm
          product={editing}
          collections={collections}
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

      {stockFor && (
        <StockDialog
          product={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={() => {
            setStockFor(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function StockDialog({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const [setTo, setSetTo] = useState(product.stock);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('stock-take');
  const [saving, setSaving] = useState(false);
  const { data, reload } = useAsync(() => adminApi.stockHistory(product.id), [product.id]);

  const apply = async (mode: 'set' | 'delta') => {
    setSaving(true);
    try {
      await adminApi.adjustStock(product.id, mode === 'set' ? { set_to: Number(setTo), reason } : { delta: Number(delta), reason });
      notify('Stock updated', 'success');
      reload();
      onSaved();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update stock', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="dialog__scrim" aria-label="Close" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Update stock">
        <div className="dialog__head">
          <div>
            <span className="eyebrow">Stock</span>
            <h3>{product.name}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <div className="dialog__body stack">
          <div className="row row--between">
            <span className="muted small">Current balance</span>
            <strong>{data?.current ?? product.stock}</strong>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Set stock to</span>
              <input className="input" type="number" min={0} value={setTo} onChange={(event) => setSetTo(Number(event.target.value))} />
              <button className="btn btn--outline btn--sm" style={{ marginTop: '0.4rem' }} disabled={saving} onClick={() => apply('set')}>
                Save balance
              </button>
            </label>
            <label className="field">
              <span>Add / remove pieces</span>
              <input className="input" type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} placeholder="-1 to deduct" />
              <button className="btn btn--outline btn--sm" style={{ marginTop: '0.4rem' }} disabled={saving} onClick={() => apply('delta')}>
                Apply change
              </button>
            </label>
            <label className="field field--full">
              <span>Reason (kept in the audit trail)</span>
              <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="loom finished / damaged / stock-take" />
            </label>
          </div>

          <div>
            <span className="eyebrow">Recent movements</span>
            <ul className="timeline" style={{ marginTop: '0.6rem' }}>
              {(data?.movements || []).slice(0, 8).map((movement) => (
                <li key={movement.id}>
                  <span className="timeline__dot" />
                  <span>
                    <strong>{movement.delta > 0 ? `+${movement.delta}` : movement.delta}</strong> → {movement.balance}
                    {' · '}{movement.reason}{movement.reference ? ` (${movement.reference})` : ''}
                    <span className="muted small"> · {formatDateTime(movement.created_at)} · {movement.actor || 'system'}</span>
                  </span>
                </li>
              ))}
              {!data?.movements.length && <li className="muted small">No movements recorded yet.</li>}
            </ul>
          </div>
        </div>

        <div className="dialog__foot">
          <button className="btn btn--outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
