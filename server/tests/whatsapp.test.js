import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildItemsText,
  buildMessageVars,
  composeApprovalMessage,
  formatINR,
  normalizePhone,
  renderTemplate,
  whatsappLink,
} from '../services/whatsapp.js';

const enquiry = {
  reference: 'SP-2026-0007',
  customer_name: 'Rutuja Deshmukh',
  phone: '9822055443',
  whatsapp: '9822055443',
  city: 'Pune',
  quoted_total: 68000,
  advance_amount: 20400,
  payment_note: 'GPay or bank transfer both work.',
};

const items = [
  { product_name: 'Peacock Munni Paithani', quantity: 1, unit_price: 68000, size: '6.3 M', color: 'Peacock Green' },
];

test('normalizePhone turns local Indian numbers into wa.me digits', () => {
  assert.equal(normalizePhone('98220 55443'), '919822055443');
  assert.equal(normalizePhone('+91 98220 55443'), '919822055443');
  assert.equal(normalizePhone('0091-9822055443'), '919822055443');
  assert.equal(normalizePhone('09822055443'), '919822055443');
  assert.equal(normalizePhone('919822055443'), '919822055443');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone('+44 7700 900123', '44'), '447700900123');
});

test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(68000), '₹68,000');
  assert.equal(formatINR(175000), '₹1,75,000');
  assert.equal(formatINR('abc'), '₹0');
});

test('buildItemsText lists each saree with size, colour and price', () => {
  const text = buildItemsText(items);
  assert.match(text, /1\. \*Peacock Munni Paithani\*/);
  assert.match(text, /Qty: 1/);
  assert.match(text, /Size: 6\.3 M/);
  assert.match(text, /₹68,000/);
  assert.equal(buildItemsText([]), '_No items listed_');
});

test('renderTemplate replaces tokens and drops empty placeholder lines', () => {
  const out = renderTemplate('Hello {{name}}\nNote: {{note}}\nBye', { name: 'Asha', note: '' });
  assert.equal(out, 'Hello Asha\nBye');
});

test('buildMessageVars computes the balance and falls back to "On request"', () => {
  const vars = buildMessageVars({ enquiry, items, settings: {}, overrides: {} });
  assert.equal(vars.balance, '₹47,600');
  assert.equal(vars.name, 'Rutuja Deshmukh');
  const noPrice = buildMessageVars({ enquiry: { ...enquiry, quoted_total: 0, advance_amount: 0 }, items: [], settings: {} });
  assert.equal(noPrice.total, 'On request');
});

test('composeApprovalMessage produces a ready-to-send message with no leftover tokens', () => {
  const message = composeApprovalMessage({
    enquiry,
    items,
    settings: { store_name: 'Sonali Handlooms', store_upi: 'sonalipaithani@upi', store_phone: '919822055443' },
    overrides: {},
  });
  assert.match(message, /Sonali Handlooms/);
  assert.match(message, /SP-2026-0007/);
  assert.match(message, /Peacock Munni Paithani/);
  assert.match(message, /Total order value:\* ₹68,000/);
  assert.match(message, /sonalipaithani@upi/);
  assert.match(message, /GPay or bank transfer both work\./);
  assert.ok(!message.includes('{{'), 'no unrendered placeholders');
});

test('admin-edited message wins over the stored template', () => {
  const message = composeApprovalMessage({
    enquiry,
    items,
    settings: { whatsapp_template: 'ignored' },
    overrides: { template: 'Hi {{name}}, order {{ref}} is confirmed. Pay {{advance}} to {{upi}}.' },
  });
  assert.equal(message, 'Hi Rutuja Deshmukh, order SP-2026-0007 is confirmed. Pay ₹20,400 to sonalipaithani@upi.');
});

test('whatsappLink encodes the message for click-to-send', () => {
  const link = whatsappLink('919822055443', 'Hi there & welcome');
  assert.equal(link, 'https://wa.me/919822055443?text=Hi%20there%20%26%20welcome');
});
