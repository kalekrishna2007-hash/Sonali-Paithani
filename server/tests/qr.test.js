import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import QRCode from 'qrcode';
import { qrPng, qrScaleFor, upiLink } from '../services/qr.js';
import { composeApprovalMessage, paymentQrUrl, renderTemplate } from '../services/whatsapp.js';

const enquiry = {
  reference: 'SP-2026-0011',
  customer_name: 'Rutuja Deshmukh',
  quoted_total: 68000,
  advance_amount: 20400,
};

const settings = { store_name: 'Sonali Paithani', store_upi: 'sonalipaithani@upi' };
const items = [{ product_name: 'Peacock Munni Paithani', quantity: 1, unit_price: 68000 }];

test('upiLink builds the deep link every UPI app scans', () => {
  const link = upiLink({ upi: 'sonalipaithani@upi', payee: 'Sonali Paithani', amount: 20400, note: 'SP-2026-0011' });
  const url = new URL(link);
  assert.equal(url.protocol, 'upi:');
  assert.equal(url.searchParams.get('pa'), 'sonalipaithani@upi');
  assert.equal(url.searchParams.get('pn'), 'Sonali Paithani');
  assert.equal(url.searchParams.get('am'), '20400.00');
  assert.equal(url.searchParams.get('cu'), 'INR');
  assert.equal(url.searchParams.get('tn'), 'SP-2026-0011');
});

test('upiLink refuses a malformed UPI id', () => {
  assert.throws(() => upiLink({ upi: 'not a vpa' }), (error) => error.status === 400);
  assert.equal(new URL(upiLink({ upi: 'sonalipaithani@upi' })).searchParams.get('am'), null, 'zero amount is omitted');
});

test('qrPng renders a valid PNG whose pixels match the QR matrix', () => {
  const link = upiLink({ upi: 'sonalipaithani@upi', payee: 'Sonali Paithani', amount: 20400 });
  const scale = qrScaleFor(link, 480);
  const png = qrPng(link, { scale });

  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  const matrix = QRCode.create(link, { errorCorrectionLevel: 'M' });
  const side = (matrix.modules.size + 8) * scale; // modules + 4-module quiet zone
  assert.equal(png.readUInt32BE(16), side, 'width fits modules + quiet zone');
  assert.equal(png.readUInt32BE(20), side, 'height matches width');
  assert.equal(png[24], 8, '8-bit depth');
  assert.equal(png[25], 6, 'RGBA colour type');

  const idat = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = side * 4 + 1;
  assert.equal(raw.length, stride * side, 'scanlines decode to the full image');

  let mismatches = 0;
  for (let row = 0; row < matrix.modules.size; row += 1) {
    for (let col = 0; col < matrix.modules.size; col += 1) {
      const x = (col + 4) * scale + Math.floor(scale / 2);
      const y = (row + 4) * scale + Math.floor(scale / 2);
      const red = raw[y * stride + 1 + x * 4];
      const isDark = red < 128;
      if (isDark !== Boolean(matrix.modules.data[row * matrix.modules.size + col])) mismatches += 1;
    }
  }
  assert.equal(mismatches, 0, 'every module lands where the encoder put it');

  // Quiet zone must stay white or scanners reject the code.
  assert.equal(raw[1], 255, 'top-left corner is white');
  assert.equal(raw[(side - 1) * stride + 1 + (side - 1) * 4], 255, 'bottom-right corner is white');
});

test('paymentQrUrl only emits a link when the public origin is known', () => {
  assert.equal(paymentQrUrl({ enquiry, settings, baseUrl: '' }), '', 'no origin → no dead link');
  const url = paymentQrUrl({ enquiry, settings, baseUrl: 'https://sonalipaithani.example/' });
  assert.match(url, /^https:\/\/sonalipaithani\.example\/api\/qr\/upi\.png\?/);
  assert.match(url, /pa=sonalipaithani%40upi/);
  assert.match(url, /am=20400\.00/);
  assert.equal(paymentQrUrl({ enquiry, settings: { store_upi: 'bad vpa' }, baseUrl: 'https://x.test' }), '');
});

test('the approval message links the payment QR image', () => {
  const message = composeApprovalMessage({
    enquiry,
    items,
    settings,
    overrides: {},
    baseUrl: 'https://sonalipaithani.example',
  });
  assert.match(message, /Scan to pay/);
  assert.match(message, /https:\/\/sonalipaithani\.example\/api\/qr\/upi\.png\?pa=/);
  assert.ok(!message.includes('{{'), 'no unrendered placeholders');
});

test('without a public origin the QR line disappears instead of leaving a label', () => {
  const message = composeApprovalMessage({ enquiry, items, settings, overrides: {} });
  assert.ok(!message.includes('Scan to pay'));
  assert.ok(!message.includes('qr/upi.png'));
  assert.match(message, /UPI ID: sonalipaithani@upi/, 'the rest of the payment block survives');
});

test('renderTemplate drops labels whose value came back empty', () => {
  assert.equal(
    renderTemplate('Pay to {{upi}}\nCode: {{payment_qr}}\nThanks', { upi: 'a@b', payment_qr: '' }),
    'Pay to a@b\nThanks',
  );
  assert.equal(renderTemplate('*Head*\n\n{{payment_qr}}\nBye', { payment_qr: '' }), '*Head*\n\nBye');
  assert.equal(
    renderTemplate('*Head*\n{{payment_qr}}\nBye', { payment_qr: '' }),
    '*Head*\nBye',
    'a token-only line with no value leaves no hole',
  );
  assert.equal(
    renderTemplate('*Head*\n{{payment_qr}}\nBye', { payment_qr: '📲 *Scan to pay*\nhttps://x.test/qr.png' }),
    '*Head*\n📲 *Scan to pay*\nhttps://x.test/qr.png\nBye',
  );
});
