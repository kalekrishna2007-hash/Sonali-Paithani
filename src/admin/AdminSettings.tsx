import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import type { StoreSettings } from '../lib/types';
import { PlusIcon } from '../components/icons';

const PLACEHOLDERS = [
  ['{{name}}', 'customer name'],
  ['{{ref}}', 'enquiry reference'],
  ['{{items}}', 'list of sarees with qty, size, colour, price'],
  ['{{total}}', 'final order value'],
  ['{{advance}}', 'advance to pay now'],
  ['{{balance}}', 'balance on delivery'],
  ['{{upi}}', 'UPI ID'],
  ['{{payment_qr}}', 'link to the payment QR code image'],
  ['{{note}}', 'payment note for this order'],
  ['{{phone}}', 'studio phone'],
  ['{{address}}', 'studio address'],
];

function PasswordCard() {
  const { notify } = useApp();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await adminApi.changePassword(form);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      notify(result.message || 'Password changed', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card__head">
        <h2>Dashboard password</h2>
        <span className="help">Guards every enquiry, price and payment detail</span>
      </div>
      <p className="help" style={{ marginBottom: '1rem' }}>
        The <code>ADMIN_PASSWORD</code> setting in the server environment only creates the account on the very first
        boot. After that, change the password here — and use at least 12 characters, not the shipped default.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <label className="field field--full">
          <span>Current password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.current_password}
            onChange={(event) => setForm({ ...form, current_password: event.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={form.new_password}
            onChange={(event) => setForm({ ...form, new_password: event.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Repeat new password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={form.confirm_password}
            onChange={(event) => setForm({ ...form, confirm_password: event.target.value })}
            required
          />
        </label>
        <div className="field field--full">
          <button className="btn btn--outline btn--sm" type="submit" disabled={saving}>
            {saving ? 'Updating…' : 'Change password'}
          </button>
        </div>
      </form>
      {error && <p className="field__error" style={{ marginTop: '0.8rem' }}>{error}</p>}
    </div>
  );
}

export function AdminSettings() {
  const { notify, refreshSettings } = useApp();
  const { data, loading, reload } = useAsync(() => adminApi.settings(), []);
  const { data: collectionData, reload: reloadCollections } = useAsync(() => adminApi.collections(), []);

  const [form, setForm] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', tagline: '', description: '', image_url: '' });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  if (loading || !form) return <div className="skeleton" style={{ height: '320px' }} />;

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    setSaving(true);
    try {
      const result = await adminApi.saveSettings(form);
      setForm(result.settings);
      await refreshSettings();
      notify('Settings saved', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await adminApi.createCollection(newCollection);
      setNewCollection({ name: '', tagline: '', description: '', image_url: '' });
      notify('Collection added', 'success');
      reloadCollections();
      reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add collection', 'error');
    }
  };

  const toggleCollection = async (id: string, isActive: boolean) => {
    try {
      await adminApi.updateCollection(id, { is_active: !isActive });
      notify(isActive ? 'Collection hidden' : 'Collection published', 'success');
      reloadCollections();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update collection', 'error');
    }
  };

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">Configuration</span>
          <h1>Store settings</h1>
        </div>
        <button className="btn btn--sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="card">
        <div className="card__head"><h2>Store profile</h2></div>
        <div className="form-grid">
          <label className="field"><span>Store name</span><input className="input" value={form.store_name} onChange={(event) => set('store_name', event.target.value)} /></label>
          <label className="field"><span>Tagline</span><input className="input" value={form.store_tagline} onChange={(event) => set('store_tagline', event.target.value)} /></label>
          <label className="field"><span>Phone (with country code, digits only)</span><input className="input" value={form.store_phone} onChange={(event) => set('store_phone', event.target.value)} /></label>
          <label className="field"><span>WhatsApp number</span><input className="input" value={form.store_whatsapp} onChange={(event) => set('store_whatsapp', event.target.value)} /></label>
          <label className="field"><span>Email</span><input className="input" value={form.store_email} onChange={(event) => set('store_email', event.target.value)} /></label>
          <label className="field"><span>Instagram</span><input className="input" value={form.store_instagram} onChange={(event) => set('store_instagram', event.target.value)} /></label>
          <label className="field field--full"><span>Address</span><input className="input" value={form.store_address} onChange={(event) => set('store_address', event.target.value)} /></label>
          <label className="field"><span>UPI ID</span><input className="input" value={form.store_upi} onChange={(event) => set('store_upi', event.target.value)} /></label>
          <label className="field"><span>Default advance %</span><input className="input" type="number" min={0} max={100} value={form.advance_percent} onChange={(event) => set('advance_percent', event.target.value)} /></label>
          <label className="field field--full">
            <span>Bank details (optional, added under the UPI line)</span>
            <input className="input" value={form.store_bank} onChange={(event) => set('store_bank', event.target.value)} placeholder="A/c 1234567890 · IFSC ABCD0001234 · Sonali Handlooms" />
          </label>
          <label className="field field--full">
            <span>Enquiry notice shown to customers</span>
            <input className="input" value={form.enquiry_notice} onChange={(event) => set('enquiry_notice', event.target.value)} />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2>WhatsApp approval template</h2>
          <span className="help">Used for every new approval, editable per order before sending</span>
          {data?.default_template && form.whatsapp_template !== data.default_template && (
            <button
              className="btn btn--quiet btn--sm"
              onClick={() => set('whatsapp_template', data.default_template as string)}
            >
              Restore default
            </button>
          )}
        </div>
        <textarea
          className="textarea"
          style={{ minHeight: '320px', fontFamily: 'monospace', fontSize: '0.85rem' }}
          value={form.whatsapp_template}
          onChange={(event) => set('whatsapp_template', event.target.value)}
        />
        <div className="chips" style={{ marginTop: '0.8rem' }}>
          {PLACEHOLDERS.map(([token, description]) => (
            <button
              key={token}
              className="chip"
              title={description}
              onClick={() => set('whatsapp_template', `${form.whatsapp_template}\n${token}`)}
            >
              {token}
            </button>
          ))}
        </div>
        <p className="help" style={{ marginTop: '0.6rem' }}>
          WhatsApp formatting: *bold*, _italic_, and real line breaks. Blank placeholder lines are removed automatically.
        </p>
      </div>

      <div className="card">
        <div className="card__head"><h2>Collections</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Slug</th><th>Products</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {(collectionData?.collections || []).map((collection) => (
                <tr key={collection.id}>
                  <td>
                    {collection.name}
                    <div className="muted small">{collection.tagline}</div>
                  </td>
                  <td className="small muted">{collection.slug}</td>
                  <td>{collection.product_count}</td>
                  <td>
                    <span className={`badge badge--${collection.is_active ? 'approved' : 'muted'}`}>
                      {collection.is_active ? 'live' : 'hidden'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn--outline btn--sm" onClick={() => toggleCollection(collection.id, collection.is_active)}>
                      {collection.is_active ? 'Hide' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="form-grid" style={{ marginTop: '1.2rem' }} onSubmit={addCollection}>
          <label className="field"><span>New collection name</span><input className="input" value={newCollection.name} onChange={(event) => setNewCollection({ ...newCollection, name: event.target.value })} required /></label>
          <label className="field"><span>Tagline</span><input className="input" value={newCollection.tagline} onChange={(event) => setNewCollection({ ...newCollection, tagline: event.target.value })} /></label>
          <label className="field"><span>Cover image URL</span><input className="input" value={newCollection.image_url} onChange={(event) => setNewCollection({ ...newCollection, image_url: event.target.value })} placeholder="/images/paithani-1.svg" /></label>
          <label className="field"><span>Description</span><input className="input" value={newCollection.description} onChange={(event) => setNewCollection({ ...newCollection, description: event.target.value })} /></label>
          <div className="field field--full">
            <button className="btn btn--outline btn--sm" type="submit">
              <PlusIcon size={14} /> Add collection
            </button>
          </div>
        </form>
      </div>

      <PasswordCard />
    </>
  );
}
