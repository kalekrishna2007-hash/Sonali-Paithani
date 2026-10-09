import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { digitsOnly, inr, inrRaw, whatsappChatUrl } from '../lib/format';
import { useApp } from '../lib/store';
import { CheckIcon, CloseIcon, TrashIcon, WhatsAppIcon } from './icons';

type Step = 'items' | 'details' | 'done';

interface Result {
  reference: string;
  customer_name: string;
  quoted_total: number;
  item_count: number;
}

export function EnquiryDialog() {
  const { enquiryOpen, closeEnquiry, cart, cartTotal, updateCartItem, removeFromCart, clearCart, settings, notify } = useApp();
  const [step, setStep] = useState<Step>('items');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    city: '',
    occasion_date: '',
    customer_note: '',
  });

  const advancePercent = Number(settings?.advance_percent || 30);
  const estimatedAdvance = useMemo(() => Math.round((cartTotal * advancePercent) / 100), [cartTotal, advancePercent]);

  useEffect(() => {
    if (!enquiryOpen) return;
    setError('');
    if (step === 'done' && result) return;
    // An enquiry is always about a named saree, so it opens on the selection step.
    if (!cart.length) setStep('items');
  }, [enquiryOpen, cart.length, step, result]);

  useEffect(() => {
    if (!enquiryOpen) return;
    const saved = localStorage.getItem('sp_customer_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<typeof form>;
        setForm((current) => ({ ...current, ...parsed }));
      } catch {
        /* ignore malformed cache */
      }
    }
  }, [enquiryOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEnquiry();
    };
    if (enquiryOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enquiryOpen, closeEnquiry]);

  if (!enquiryOpen) return null;

  const phoneDigits = digitsOnly(form.phone).replace(/^0+/, '');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!cart.length) return setError('Pick the saree you want to enquire about first');
    if (form.customer_name.trim().length < 2) return setError('Please share your name');
    if (phoneDigits.length < 10) return setError('Please share a 10-digit WhatsApp number');

    setSaving(true);
    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        whatsapp: (form.whatsapp || form.phone).trim(),
        email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        occasion_date: form.occasion_date || undefined,
        customer_note: form.customer_note.trim() || undefined,
        source: 'website' as const,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          size: item.size || undefined,
          color: item.color || undefined,
          notes: item.notes || undefined,
        })),
      };
      const response = await api.createEnquiry(payload);
      localStorage.setItem(
        'sp_customer_v1',
        JSON.stringify({
          customer_name: payload.customer_name,
          phone: payload.phone,
          whatsapp: payload.whatsapp,
          email: payload.email || '',
          city: payload.city || '',
        }),
      );
      setResult(response.enquiry);
      setStep('done');
      clearCart();
      notify('Enquiry sent! Our studio will confirm on WhatsApp.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your enquiry');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    closeEnquiry();
    if (step === 'done') {
      setStep('items');
      setResult(null);
    }
  };

  return (
    <>
      <button className="dialog__scrim" aria-label="Close enquiry" onClick={close} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Send an enquiry">
        <div className="dialog__head">
          <div>
            <span className="eyebrow">{step === 'done' ? 'Enquiry received' : `Send an enquiry${cart.length > 1 ? ` · ${cart.length} sarees` : ''}`}</span>
            <h3>
              {step === 'items' && 'Your selection'}
              {step === 'details' &&
                (cart.length === 1 ? `Enquiry for ${cart[0].product.name}` : 'How should we reach you?')}
              {step === 'done' && `Thank you${result ? `, ${result.customer_name.split(' ')[0]}` : ''}!`}
            </h3>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="dialog__body">
          {step === 'done' && result ? (
            <div className="stack">
              <div className="whatsapp-box">
                <CheckIcon size={22} />
                <div>
                  <strong>Your enquiry reference is {result.reference}</strong>
                  <p className="help" style={{ margin: 0 }}>
                    {result.item_count} saree{result.item_count > 1 ? 's' : ''} · estimated value {inrRaw(result.quoted_total)}
                  </p>
                </div>
              </div>

              <ol className="timeline">
                <li>
                  <span className="timeline__dot" />
                  <span>Our studio checks availability and confirms the final price with you on WhatsApp.</span>
                </li>
                <li>
                  <span className="timeline__dot" />
                  <span>Once you approve, we share the payment details and the advance amount.</span>
                </li>
                <li>
                  <span className="timeline__dot" />
                  <span>Weaving begins and we keep sending progress updates until delivery.</span>
                </li>
              </ol>

              <p className="help">
                Save your reference number <strong>{result.reference}</strong> — you can track it any time from the
                {' '}<Link to="/track">track enquiry</Link> page.
              </p>

              <div className="row row--wrap">
                <a
                  className="btn"
                  href={whatsappChatUrl(
                    settings?.store_whatsapp || '919822055443',
                    `Namaskar! I just sent enquiry ${result.reference} on your website. Please confirm availability.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <WhatsAppIcon size={16} /> Message the studio now
                </a>
                <button className="btn btn--outline" onClick={close}>
                  Continue browsing
                </button>
              </div>
            </div>
          ) : step === 'items' || !cart.length ? (
            <div className="stack">
              {!!cart.length && (
                <p className="help">
                  Your enquiry travels to our studio with the exact saree{cart.length > 1 ? 's' : ''} below — our weaver
                  checks availability for {cart.length === 1 ? 'this piece' : 'these pieces'} and nothing else.{' '}
                  {settings?.enquiry_notice || 'Every saree is woven to order. Advance booking confirms your piece.'}
                </p>
              )}

              {cart.map((item) => (
                <div className="line-item" key={item.product.id}>
                  <img src={item.product.images[0] || '/images/paithani-1.svg'} alt={item.product.name} />
                  <div>
                    <strong>{item.product.name}</strong>
                    <div className="muted small">{inr(item.product.price)} each</div>
                    <div className="line-item__fields">
                      <label className="field">
                        <span className="small muted">Quantity</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={20}
                          value={item.quantity}
                          onChange={(event) =>
                            updateCartItem(item.product.id, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="small muted">Size</span>
                        <select
                          className="select"
                          value={item.size}
                          onChange={(event) => updateCartItem(item.product.id, { size: event.target.value })}
                        >
                          <option value="">Any / discuss</option>
                          {item.product.sizes.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="small muted">Colour</span>
                        <select
                          className="select"
                          value={item.color}
                          onChange={(event) => updateCartItem(item.product.id, { color: event.target.value })}
                        >
                          <option value="">Any / discuss</option>
                          {item.product.colors.map((color) => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span className="small muted">Note for the weaver (optional)</span>
                        <input
                          className="input"
                          value={item.notes}
                          placeholder="e.g. need before 12 November wedding"
                          onChange={(event) => updateCartItem(item.product.id, { notes: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong>{inrRaw(item.product.price * item.quantity)}</strong>
                    <div>
                      <button className="icon-btn" onClick={() => removeFromCart(item.product.id)} aria-label="Remove">
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!cart.length && (
                <div className="empty">
                  <h3>Pick the saree you want to enquire about</h3>
                  <p className="muted">
                    Every enquiry is for one particular saree. Open a saree you love and tap <strong>Enquire</strong> —
                    we will carry its name, price, size and colour to our studio with your enquiry.
                  </p>
                  <Link className="btn btn--outline btn--sm" to="/shop" onClick={close}>
                    Browse the collection
                  </Link>
                </div>
              )}

              {!!cart.length && (
                <div className="totals">
                  <div>
                    <span>Estimated value</span>
                    <strong>{inrRaw(cartTotal)}</strong>
                  </div>
                  <div>
                    <span>Advance (~{advancePercent}%)</span>
                    <span>{inrRaw(estimatedAdvance)}</span>
                  </div>
                  <div className="totals__grand">
                    <span>Final price</span>
                    <span>Confirmed by our studio</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form className="stack" onSubmit={submit} id="enquiry-form">
              <div className="enquiry-subject">
                <span className="eyebrow">
                  Saree in this enquiry{cart.length > 1 ? ` (${cart.length})` : ''}
                </span>
                {cart.map((item) => (
                  <div className="enquiry-subject__row" key={item.product.id}>
                    <img src={item.product.images[0] || '/images/paithani-1.svg'} alt={item.product.name} />
                    <div>
                      <strong>{item.product.name}</strong>
                      <span className="small muted">
                        {[item.size || 'size to discuss', item.color || 'colour to discuss'].join(' · ')} · Qty{' '}
                        {item.quantity}
                      </span>
                    </div>
                    <span className="small">{inrRaw(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Your name *</span>
                  <input
                    className="input"
                    value={form.customer_name}
                    onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
                    placeholder="Rutuja Deshmukh"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="field">
                  <span>WhatsApp number *</span>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="98220 55443"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                  <span className="help">We will send your approval and payment details here.</span>
                </label>
                <label className="field">
                  <span>Another number (optional)</span>
                  <input
                    className="input"
                    value={form.whatsapp}
                    onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
                    placeholder="Leave blank to use the number above"
                    inputMode="tel"
                  />
                </label>
                <label className="field">
                  <span>Email (optional)</span>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    autoComplete="email"
                  />
                </label>
                <label className="field">
                  <span>City</span>
                  <input
                    className="input"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                    placeholder="Nashik"
                    autoComplete="address-level2"
                  />
                </label>
                <label className="field">
                  <span>Occasion date</span>
                  <input
                    className="input"
                    type="date"
                    value={form.occasion_date}
                    onChange={(event) => setForm({ ...form, occasion_date: event.target.value })}
                  />
                </label>
                <label className="field field--full">
                  <span>Anything else we should know?</span>
                  <textarea
                    className="textarea"
                    value={form.customer_note}
                    onChange={(event) => setForm({ ...form, customer_note: event.target.value })}
                    placeholder="Colour preference, budget range, delivery timeline…"
                  />
                </label>
              </div>



              {error && <p className="field__error">{error}</p>}
            </form>
          )}
        </div>

        <div className="dialog__foot">
          {step === 'items' && (
            <>
              <button className="btn btn--outline" onClick={close}>
                Keep browsing
              </button>
              <button className="btn" onClick={() => setStep('details')} disabled={!cart.length}>
                Continue
              </button>
            </>
          )}
          {step === 'details' && (
            <>
              <button className="btn btn--outline" onClick={() => setStep('items')}>
                Back
              </button>
              <button className="btn" type="submit" form="enquiry-form" disabled={saving}>
                {saving ? 'Sending…' : 'Send enquiry'}
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn btn--outline" onClick={close}>
              Done
            </button>
          )}
        </div>
      </div>
    </>
  );
}
