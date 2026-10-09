import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type TrackedEnquiry } from '../lib/api';
import { formatDate, inrRaw } from '../lib/format';
import { useApp } from '../lib/store';
import type { EnquiryStatus } from '../lib/types';

const STATUS_COPY: Record<EnquiryStatus, string> = {
  pending: 'With our studio — we are checking availability and price.',
  approved: 'Approved! Payment details have been shared on your WhatsApp.',
  rejected: 'We could not proceed with this enquiry. Our studio will be in touch.',
  completed: 'Completed — thank you for choosing handloom.',
  cancelled: 'This enquiry was cancelled.',
};

export function Track() {
  const { notify } = useApp();
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<TrackedEnquiry | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      setResult(await api.enquiryStatus(reference.trim().toUpperCase(), phone.trim()));
      notify('Enquiry found', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that enquiry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '720px' }}>
        <span className="eyebrow">Order status</span>
        <h1 style={{ marginTop: '0.3rem' }}>Track your enquiry</h1>
        <p className="muted">
          Enter the reference number we gave you (e.g. SP-2026-0001) and the WhatsApp number you enquired with.
        </p>

        <form className="card" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Enquiry reference</span>
              <input
                className="input"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="SP-2026-0001"
                required
              />
            </label>
            <label className="field">
              <span>WhatsApp number</span>
              <input
                className="input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="98220 55443"
                inputMode="tel"
                required
              />
            </label>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Check status'}
            </button>
          </div>
          {error && <p className="field__error" style={{ marginTop: '0.8rem' }}>{error}</p>}
        </form>

        {result && (
          <div className="card">
            <div className="card__head">
              <h3>{reference.toUpperCase()}</h3>
              <span className={`badge badge--${result.status}`}>{result.status}</span>
            </div>
            <p>{STATUS_COPY[result.status]}</p>
            <ul className="timeline">
              <li><span className="timeline__dot" /> Enquiry received · {formatDate(result.created_at)}</li>
              {result.approved_at && <li><span className="timeline__dot" /> Approved &amp; sent on WhatsApp · {formatDate(result.approved_at)}</li>}
            </ul>
            <dl className="pdp__spec" style={{ marginBottom: 0 }}>
              <dt>Order value</dt>
              <dd>{inrRaw(result.quoted_total)}</dd>
              <dt>Advance</dt>
              <dd>{inrRaw(result.advance_amount)}</dd>
            </dl>
            {result.items?.length ? (
              <ul className="small muted" style={{ marginTop: '0.8rem' }}>
                {result.items.map((item) => (
                  <li key={item.product_name}>{item.product_name} × {item.quantity}</li>
                ))}
              </ul>
            ) : null}
            <p className="help" style={{ marginTop: '1rem' }}>
              Questions? <Link to="/">Message our studio on WhatsApp</Link> and quote your reference.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
