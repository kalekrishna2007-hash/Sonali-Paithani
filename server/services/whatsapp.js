import { config } from '../env.js';
import { upiLink } from './qr.js';

/**
 * Turns whatever the customer typed ("98220 55443", "+91 98220 55443",
 * "0091-9822055443") into the digits-only format wa.me expects.
 */
export function normalizePhone(raw, countryCode = config.defaultCountryCode) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  digits = digits.replace(/^\+/, '').replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `${countryCode}${digits.slice(1)}`;
  return digits;
}

export function formatINR(amount) {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  return `₹${safe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** One numbered block per saree, exactly as it should read on a phone. */
export function buildItemsText(items = []) {
  if (!items.length) return '_No items listed_';
  return items
    .map((item, index) => {
      const lines = [`${index + 1}. *${item.product_name}*`];
      const meta = [];
      if (item.quantity) meta.push(`Qty: ${item.quantity}`);
      if (item.size) meta.push(`Size: ${item.size}`);
      if (item.color) meta.push(`Colour: ${item.color}`);
      if (meta.length) lines.push(`   ${meta.join('  |  ')}`);
      if (Number(item.unit_price) > 0) lines.push(`   ${formatINR(item.unit_price * item.quantity)}`);
      if (item.notes) lines.push(`   Note: ${item.notes}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

export const DEFAULT_WHATSAPP_TEMPLATE = `🙏 *{{store}}*

Dear {{name}}, thank you for your enquiry *{{ref}}*.

✅ *Your selection is approved*

{{items}}

━━━━━━━━━━━━━━━
*Total order value:* {{total}}
*Advance to confirm:* {{advance}}
*Balance on delivery:* {{balance}}

*Payment details*
UPI ID: {{upi}}
Payee: {{store}}
{{payment_qr}}
{{note}}

Please share the payment screenshot on this chat and we will confirm your order the same day.

📞 {{phone}}
{{address}}

— Handwoven in Yeola since 1978`;

/**
 * Public URL of the payment QR image that the approval message links to.
 * Empty when the site origin is unknown or the UPI id is malformed — the
 * template line then drops out instead of shipping a dead link.
 */
export function paymentQrUrl({ enquiry = {}, settings = {}, overrides = {}, baseUrl = '' } = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  if (!origin) return '';
  try {
    const link = upiLink({
      upi: settings.store_upi || config.store.upi,
      payee: settings.store_name || config.store.name,
      amount: Number(overrides.advance_amount ?? enquiry.advance_amount ?? 0),
      note: enquiry.reference,
    });
    return `${origin}/api/qr/upi.png?${link.slice(link.indexOf('?') + 1)}`;
  } catch {
    return '';
  }
}

/** Replaces {{tokens}} and cleans up blank placeholder lines. */
export function renderTemplate(template, vars = {}) {
  const lines = String(template || '')
    .split('\n')
    .map((line) => ({
      value: line.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
        vars[key] === undefined || vars[key] === null ? '' : String(vars[key]),
      ),
      hadToken: /\{\{\s*\w+\s*\}\}/.test(line),
    }))
    .filter(({ value, hadToken }) => {
      const trimmed = value.trim();
      if (!trimmed) {
        // Literal blank lines are layout; a line that was only a token with no
        // value (the payment QR, for instance) would just leave a hole.
        return !hadToken && value === '';
      }
      // "UPI ID:" with no value after it — the token was empty, so the label
      // goes too rather than leaving a dangling colon in the message.
      return !/^[*_~]*[^:*_\n]+:\s*[*_~]*$/.test(trimmed);
    })
    .map(({ value }) => value.trimEnd());

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Builds every variable available to the template from an enquiry payload. */
export function buildMessageVars({ enquiry, items, settings = {}, overrides = {}, baseUrl = '' }) {
  const total = Number(overrides.total_amount ?? enquiry.quoted_total ?? 0);
  const advance = Number(overrides.advance_amount ?? enquiry.advance_amount ?? 0);
  const qr = paymentQrUrl({ enquiry, settings, overrides, baseUrl });
  return {
    payment_qr: qr ? `📲 *Scan to pay*\n${qr}` : '',
    qr_url: qr,
    store: settings.store_name || config.store.name,
    name: enquiry.customer_name || 'there',
    ref: enquiry.reference,
    items: buildItemsText(items),
    total: total > 0 ? formatINR(total) : 'On request',
    advance: advance > 0 ? formatINR(advance) : 'On request',
    balance: total > 0 ? formatINR(Math.max(total - advance, 0)) : 'On request',
    upi: settings.store_upi || config.store.upi,
    phone: settings.store_phone || config.store.phone,
    address: settings.store_address || config.store.address,
    city: enquiry.city || '',
    note: overrides.payment_note ?? enquiry.payment_note ?? '',
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    item_count: String(items.length),
  };
}

/**
 * Composes the final WhatsApp text. Admin edits win over the stored template,
 * and unfilled optional lines are stripped so the message never looks broken.
 */
export function composeApprovalMessage({ enquiry, items, settings = {}, overrides = {}, baseUrl = '' }) {
  const template = overrides.template || settings.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE;
  const vars = buildMessageVars({ enquiry, items, settings, overrides, baseUrl });
  return renderTemplate(template, vars);
}

/** Free click-to-send link — opens WhatsApp with the message pre-filled. */
export function whatsappLink(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildApprovalWhatsApp({ enquiry, items, settings, overrides, baseUrl = '' }) {
  const phone = normalizePhone(enquiry.whatsapp || enquiry.phone);
  const message = composeApprovalMessage({ enquiry, items, settings, overrides, baseUrl });
  return {
    phone,
    message,
    chat_url: `https://wa.me/${phone}`,
    send_url: whatsappLink(phone, message),
    qr_url: paymentQrUrl({ enquiry, settings, overrides, baseUrl }),
  };
}
