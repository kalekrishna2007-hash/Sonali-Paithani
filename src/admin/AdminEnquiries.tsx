import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { formatDateTime, inrRaw, relativeTime, telHref } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useApp } from '../lib/store';
import type { Enquiry, EnquiryStatus } from '../lib/types';
import { CloseIcon, WhatsAppIcon } from '../components/icons';

/** Every enquiry is for a named saree — show it, not just a count. */
function SareeCell({ enquiry }: { enquiry: Enquiry }) {
  const first = enquiry.items?.[0];
  if (!first) return <span className="muted small">{enquiry.item_count} item{enquiry.item_count === 1 ? '' : 's'}</span>;
  const extra = Math.max(Number(enquiry.item_count || 1) - 1, 0);
  return (
    <>
      {first.product_name}
      <div className="muted small">
        {extra > 0 ? `+${extra} more · ` : ''}Qty {first.quantity}
      </div>
    </>
  );
}

const TABS: { value: EnquiryStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

export function AdminEnquiries() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<EnquiryStatus | 'all'>((params.get('status') as EnquiryStatus) || 'pending');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(params.get('open') || '');

  const { data, loading, reload } = useAsync(
    () => adminApi.enquiries({ status, search: search || undefined }),
    [status, search],
  );

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (openId) next.set('open', openId);
    else next.delete('open');
    if (status !== 'pending') next.set('status', status);
    else next.delete('status');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, status]);

  return (
    <>
      <div className="admin__topbar">
        <div>
          <span className="eyebrow">Enquiries</span>
          <h1>Customer requests</h1>
        </div>
        <div className="row row--wrap">
          <input
            className="input"
            style={{ minWidth: '220px' }}
            placeholder="Search name, reference or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="chips" style={{ marginBottom: '1.2rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`chip${status === tab.value ? ' is-active' : ''}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
            {data?.counts?.[tab.value] !== undefined ? ` (${data.counts[tab.value]})` : ''}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Saree</th>
              <th>Value</th>
              <th>Status</th>
              <th>Received</th>
              <th>WhatsApp</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((enquiry) => (
              <tr key={enquiry.id} className={openId === enquiry.id ? 'is-selected' : ''}>
                <td><strong>{enquiry.reference}</strong></td>
                <td>
                  {enquiry.customer_name}
                  <div className="muted small">{enquiry.city || '—'} · {enquiry.phone}</div>
                </td>
                <td><SareeCell enquiry={enquiry} /></td>
                <td>{enquiry.quoted_total ? inrRaw(enquiry.quoted_total) : <span className="muted small">to quote</span>}</td>
                <td><span className={`badge badge--${enquiry.status}`}>{enquiry.status}</span></td>
                <td className="small muted">{relativeTime(enquiry.created_at)}</td>
                <td className="small muted">{enquiry.whatsapp_sent_at ? formatDateTime(enquiry.whatsapp_sent_at) : 'not sent'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn--outline btn--sm" onClick={() => setOpenId(enquiry.id)}>Open</button>
                    <a className="btn btn--outline btn--sm" href={telHref(enquiry.phone)}>Call</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !data?.rows.length && (
        <div className="empty" style={{ marginTop: '1rem' }}>
          <h3>No {status === 'all' ? '' : status} enquiries</h3>
          <p className="muted">New customer enquiries appear here the moment they are sent from the storefront.</p>
        </div>
      )}

      {openId && (
        <EnquiryDetail id={openId} onClose={() => setOpenId('')} onChanged={reload} />
      )}
    </>
  );
}

function EnquiryDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { notify } = useApp();
  const { data, loading, reload } = useAsync(() => adminApi.enquiry(id), [id]);
  const { data: meta } = useAsync(() => adminApi.meta(), [id]);
  const enquiry = data?.enquiry;

  const [total, setTotal] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [deductStock, setDeductStock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sendLink, setSendLink] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [stockWarning, setStockWarning] = useState<string[]>([]);

  const advancePercent = Number(meta?.settings.advance_percent || 30);

  const refreshPreview = useCallback(
    async (overrides: { total_amount?: number; advance_amount?: number; payment_note?: string }) => {
      if (!enquiry) return;
      try {
        const result = await adminApi.previewApproval(enquiry.id, overrides);
        setMessage(result.whatsapp.message);
        setQrUrl(result.whatsapp.qr_url || '');
        setDirty(false);
      } catch {
        /* keep whatever the admin typed */
      }
    },
    [enquiry],
  );

  useEffect(() => {
    if (!enquiry) return;
    setTotal(Number(enquiry.quoted_total || 0));
    setAdvance(Number(enquiry.advance_amount || 0));
    setPaymentNote(enquiry.payment_note || '');
    setAdminNote(enquiry.admin_note || '');
    setDeductStock(!enquiry.stock_released);
    if (enquiry.last_message) {
      setMessage(enquiry.last_message);
      setDirty(false);
    } else {
      void refreshPreview({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiry?.id]);

  // Keep the WhatsApp draft in sync with the numbers, unless the admin edited it.
  useEffect(() => {
    if (!enquiry || dirty) return;
    const timer = window.setTimeout(() => {
      void refreshPreview({ total_amount: total, advance_amount: advance, payment_note: paymentNote });
    }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, advance, paymentNote, dirty, enquiry?.id]);

  const approve = async () => {
    if (!enquiry) return;
    setBusy(true);
    setStockWarning([]);
    setSendLink('');
    // Open the tab straight away so the browser does not treat it as a popup.
    const tab = window.open('', '_blank');
    try {
      const result = await adminApi.approve(enquiry.id, {
        total_amount: total,
        advance_amount: advance,
        payment_note: paymentNote,
        admin_note: adminNote || undefined,
        message: dirty ? message : undefined,
        deduct_stock: deductStock,
      });

      setSendLink(result.whatsapp.send_url);
      setQrUrl(result.whatsapp.qr_url || '');
      const warnings = result.stock_changes
        .filter((change) => change.oversold)
        .map((change) => `${change.name} is now oversold (${change.balance}) — arrange another piece`);
      setStockWarning(warnings);

      if (tab) {
        tab.location.href = result.whatsapp.send_url;
        await adminApi.markSent(enquiry.id, result.whatsapp.message);
        notify('Approved — WhatsApp opened with the message ready to send', 'success');
      } else {
        notify('Approved. Click “Open WhatsApp” to send the message.', 'info');
      }
      reload();
      onChanged();
    } catch (error) {
      tab?.close();
      notify(error instanceof Error ? error.message : 'Could not approve', 'error');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (next: EnquiryStatus, reason?: string) => {
    if (!enquiry) return;
    setBusy(true);
    try {
      await adminApi.setStatus(enquiry.id, next, reason);
      notify(`Enquiry marked ${next}`, 'success');
      reload();
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const waMessage = enquiry ? `Namaskar ${enquiry.customer_name.split(' ')[0]}! About your enquiry ${enquiry.reference}…` : '';
  const customerWa = enquiry ? `https://wa.me/${(enquiry.whatsapp || enquiry.phone).replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}` : '#';

  return (
    <>
      <button className="dialog__scrim" aria-label="Close" onClick={onClose} />
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-label="Enquiry details">
        <div className="dialog__head">
          <div>
            <span className="eyebrow">Enquiry {enquiry?.reference || ''}</span>
            <h3>{enquiry ? enquiry.customer_name : 'Loading…'}</h3>
            {enquiry?.items?.length ? (
              <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
                For {enquiry.items.map((item) => item.product_name).join(', ')}
              </p>
            ) : null}
          </div>
          <div className="row">
            {enquiry && <span className={`badge badge--${enquiry.status}`}>{enquiry.status}</span>}
            <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
          </div>
        </div>

        <div className="dialog__body">
          {loading || !enquiry ? (
            <div className="skeleton" style={{ height: '220px' }} />
          ) : (
            <div className="form-grid" style={{ gridTemplateColumns: '1.05fr 0.95fr', alignItems: 'start' }}>
              <div className="stack">
                <div className="card" style={{ margin: 0 }}>
                  <h3>Customer</h3>
                  <p className="small" style={{ marginBottom: '0.4rem' }}>
                    <a href={telHref(enquiry.phone)}><strong>{enquiry.phone}</strong></a>
                    {enquiry.whatsapp && enquiry.whatsapp !== enquiry.phone ? ` · alt ${enquiry.whatsapp}` : ''}
                    {enquiry.email ? ` · ${enquiry.email}` : ''}
                  </p>
                  <p className="small muted" style={{ marginBottom: '0.4rem' }}>
                    {[enquiry.city, enquiry.country].filter(Boolean).join(', ') || 'Location not shared'}
                    {enquiry.occasion_date ? ` · needs it by ${enquiry.occasion_date}` : ''}
                  </p>
                  <p className="small muted">
                    Received {formatDateTime(enquiry.created_at)} · source {enquiry.source}
                  </p>
                  {enquiry.customer_note && (
                    <blockquote style={{ margin: '0.6rem 0 0', paddingLeft: '0.8rem', borderLeft: '2px solid var(--gold)', fontStyle: 'italic' }}>
                      {enquiry.customer_note}
                    </blockquote>
                  )}
                  <div className="row row--wrap" style={{ marginTop: '0.9rem' }}>
                    <a className="btn btn--outline btn--sm" href={customerWa} target="_blank" rel="noreferrer">
                      <WhatsAppIcon size={14} /> Chat
                    </a>
                    <a className="btn btn--outline btn--sm" href={telHref(enquiry.phone)}>Call</a>
                  </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <h3>Requested pieces</h3>
                  <div className="table-wrap" style={{ border: 0 }}>
                    <table>
                      <thead>
                        <tr><th>Saree</th><th>Qty</th><th>Size / colour</th><th>Line</th></tr>
                      </thead>
                      <tbody>
                        {enquiry.items?.map((item) => (
                          <tr key={item.id}>
                            <td>{item.product_name}{item.notes && <div className="muted small">{item.notes}</div>}</td>
                            <td>{item.quantity}</td>
                            <td className="small">{[item.size, item.color].filter(Boolean).join(' · ') || '—'}</td>
                            <td>{inrRaw(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="help">
                    Price shown is the catalogue value. Set the final agreed total on the right.
                  </p>
                </div>

                {enquiry.messages?.length ? (
                  <div className="card" style={{ margin: 0 }}>
                    <h3>Message history</h3>
                    <ul className="timeline">
                      {enquiry.messages.map((log) => (
                        <li key={log.id}>
                          <span className="timeline__dot" />
                          <span>
                            {log.status} to {log.phone} · {formatDateTime(log.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="stack">
                <div className="card" style={{ margin: 0 }}>
                  <h3>Quote &amp; approval</h3>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <label className="field">
                      <span>Final total (₹)</span>
                      <input className="input" type="number" min={0} value={total} onChange={(event) => setTotal(Number(event.target.value))} />
                    </label>
                    <label className="field">
                      <span>Advance (₹)</span>
                      <input className="input" type="number" min={0} value={advance} onChange={(event) => setAdvance(Number(event.target.value))} />
                    </label>
                  </div>

                  <div className="row row--wrap" style={{ gap: '0.4rem', marginTop: '0.6rem' }}>
                    {[30, 40, 50, 100].map((percent) => (
                      <button
                        key={percent}
                        className="chip"
                        onClick={() => setAdvance(Math.round((total * percent) / 100))}
                      >
                        {percent}% advance
                      </button>
                    ))}
                    <span className="help">Store default: {advancePercent}%</span>
                  </div>

                  <label className="field" style={{ marginTop: '0.8rem' }}>
                    <span>Payment note (shown to the customer)</span>
                    <input
                      className="input"
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="e.g. Courier included. Balance before dispatch."
                    />
                  </label>

                  <label className="field" style={{ marginTop: '0.8rem' }}>
                    <span>Internal note (never sent)</span>
                    <input className="input" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Colour approved on call" />
                  </label>

                  <label className="row" style={{ gap: '0.5rem', marginTop: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={deductStock}
                      onChange={(event) => setDeductStock(event.target.checked)}
                      disabled={enquiry.stock_released}
                    />
                    <span className="small">
                      Deduct pieces from stock on approval
                      {enquiry.stock_released ? ' (already released)' : ''}
                    </span>
                  </label>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <div className="card__head">
                    <h3>WhatsApp message</h3>
                    <button className="btn btn--quiet btn--sm" onClick={() => refreshPreview({ total_amount: total, advance_amount: advance, payment_note: paymentNote })}>
                      Reset to template
                    </button>
                  </div>
                  <textarea
                    className="textarea"
                    style={{ minHeight: '230px', fontFamily: 'var(--sans)' }}
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      setDirty(true);
                    }}
                  />
                  <p className="help">
                    Edit freely — this exact text is sent on WhatsApp. {dirty ? 'Manual edits are kept.' : 'Synced with the template.'}
                  </p>

                  {stockWarning.map((warning) => (
                    <p className="field__error" key={warning}>{warning}</p>
                  ))}

                  {qrUrl && (
                    <div className="qr-preview">
                      <img src={qrUrl} alt="Payment QR code" width={112} height={112} />
                      <div className="qr-preview__body">
                        <strong>Payment QR code</strong>
                        <p className="help">
                          Linked in the message above — the customer taps it to open the QR. Download it if you would
                          rather attach the image to the chat too.
                        </p>
                        <a
                          className="btn btn--outline btn--sm"
                          href={qrUrl}
                          download={`sonali-paithani-${enquiry.reference}-qr.png`}
                        >
                          Download QR image
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="whatsapp-box" style={{ marginTop: '0.8rem' }}>
                    <WhatsAppIcon size={20} />
                    <span className="small" style={{ flex: 1 }}>
                      Sends to <strong>+{enquiry.whatsapp || enquiry.phone}</strong>
                    </span>
                    {sendLink ? (
                      <a className="btn btn--sm" href={sendLink} target="_blank" rel="noreferrer" onClick={() => adminApi.markSent(enquiry.id, message)}>
                        Open WhatsApp
                      </a>
                    ) : (
                      <button className="btn btn--sm" onClick={approve} disabled={busy}>
                        {busy ? 'Approving…' : enquiry.status === 'approved' ? 'Re-send approval' : 'Approve & send'}
                      </button>
                    )}
                  </div>

                  <div className="row row--wrap" style={{ marginTop: '0.8rem' }}>
                    {enquiry.status !== 'completed' && (
                      <button className="btn btn--outline btn--sm" onClick={() => changeStatus('completed')} disabled={busy}>
                        Mark completed
                      </button>
                    )}
                    {enquiry.status === 'approved' && (
                      <button className="btn btn--outline btn--sm" onClick={() => changeStatus('cancelled', window.prompt('Reason for cancelling?') || 'cancelled')} disabled={busy}>
                        Cancel order
                      </button>
                    )}
                    {enquiry.status === 'pending' && (
                      <button className="btn btn--danger btn--sm" onClick={() => changeStatus('rejected', window.prompt('Why are we rejecting this enquiry?') || 'Not available')} disabled={busy}>
                        Reject enquiry
                      </button>
                    )}
                  </div>

                  {enquiry.approved_at && (
                    <p className="help" style={{ marginTop: '0.6rem' }}>
                      Approved {formatDateTime(enquiry.approved_at)}
                      {enquiry.whatsapp_sent_at ? ` · sent on WhatsApp ${formatDateTime(enquiry.whatsapp_sent_at)}` : ' · WhatsApp not marked as sent yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dialog__foot">
          <button className="btn btn--outline btn--sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
