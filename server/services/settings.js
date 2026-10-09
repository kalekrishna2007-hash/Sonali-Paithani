import { config } from '../env.js';
import { q } from '../db.js';
import { DEFAULT_WHATSAPP_TEMPLATE } from './whatsapp.js';

export const DEFAULT_SETTINGS = {
  store_name: config.store.name,
  store_tagline: 'A legacy in every weave',
  store_phone: config.store.phone,
  store_whatsapp: config.store.whatsapp,
  store_email: config.store.email,
  store_address: config.store.address,
  store_upi: config.store.upi,
  store_bank: '',
  store_instagram: 'https://instagram.com/sonalipaithani',
  default_country_code: config.defaultCountryCode,
  advance_percent: '30',
  whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
  enquiry_notice: 'Every saree is woven to order. Advance booking confirms your piece.',
};

export const PUBLIC_SETTING_KEYS = [
  'store_name',
  'store_tagline',
  'store_phone',
  'store_whatsapp',
  'store_email',
  'store_address',
  'store_upi',
  'store_instagram',
  'advance_percent',
  'enquiry_notice',
];

export async function getSettings() {
  const rows = await q('select key, value from settings');
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch = {}) {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await q(
      `insert into settings (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value === null || value === undefined ? '' : String(value)],
    );
  }
  return getSettings();
}

export async function publicSettings() {
  const all = await getSettings();
  return Object.fromEntries(PUBLIC_SETTING_KEYS.map((key) => [key, all[key]]));
}
