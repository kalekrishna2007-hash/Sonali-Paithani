import QRCode from 'qrcode';
import zlib from 'node:zlib';

/**
 * Builds the UPI deep link a payment QR has to encode so any UPI app
 * (GPay, PhonePe, Paytm, BHIM) can scan it and prefill the payee + amount.
 * `upi://pay` is the scheme agreed under the UPI specification.
 */
export function upiLink({ upi, payee = '', amount, note = '' } = {}) {
  const pa = String(upi || '').trim();
  if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9._-]{2,}$/.test(pa)) {
    const error = new Error('That does not look like a valid UPI ID');
    error.status = 400;
    throw error;
  }

  const params = new URLSearchParams({ pa, cu: 'INR' });
  if (payee) params.set('pn', String(payee).trim().slice(0, 99));
  const value = Number(amount);
  if (Number.isFinite(value) && value > 0) params.set('am', value.toFixed(2));
  const txn = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (txn) params.set('tn', txn);
  return `upi://pay?${params.toString()}`;
}

/** PNG signature: 89 50 4E 47 0D 0A 1A 0A */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const value = Number.parseInt(full.slice(0, 6) || '000000', 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Whole-pixel scale that lands closest to `targetPx` for a given payload,
 * so modules stay razor sharp (no half pixels to blur the scan).
 */
export function qrScaleFor(text, targetPx, { margin = 4 } = {}) {
  const modules = QRCode.create(String(text), { errorCorrectionLevel: 'M' }).modules.size;
  const across = modules + margin * 2;
  return Math.max(2, Math.round(Number(targetPx) / across) || 6);
}

/**
 * Renders text as a QR code PNG in pure Node — no canvas or native addon, so it
 * installs anywhere (the project must run on free tiers with nothing to compile).
 */
export function qrPng(text, { scale = 6, margin = 4, dark = '#141414', light = '#ffffff' } = {}) {
  const qr = QRCode.create(String(text), { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size;
  const step = Math.max(1, Math.round(scale));
  const quiet = Math.max(0, Math.round(margin));
  const side = (modules + quiet * 2) * step;

  const [dr, dg, db] = hexToRgb(dark);
  const [lr, lg, lb] = hexToRgb(light);
  const stride = side * 4 + 1; // +1 filter byte per scanline
  const raw = Buffer.alloc(stride * side);

  for (let y = 0; y < side; y += 1) {
    const row = y * stride;
    raw[row] = 0; // filter type: none
    for (let x = 0; x < side; x += 1) {
      const i = row + 1 + x * 4;
      raw[i] = lr;
      raw[i + 1] = lg;
      raw[i + 2] = lb;
      raw[i + 3] = 255;
    }
  }

  for (let my = 0; my < modules; my += 1) {
    for (let mx = 0; mx < modules; mx += 1) {
      if (!qr.modules.data[my * modules + mx]) continue;
      const x0 = (mx + quiet) * step;
      const y0 = (my + quiet) * step;
      for (let dy = 0; dy < step; dy += 1) {
        const row = (y0 + dy) * stride + 1;
        for (let dx = 0; dx < step; dx += 1) {
          const i = row + (x0 + dx) * 4;
          raw[i] = dr;
          raw[i + 1] = dg;
          raw[i + 2] = db;
          raw[i + 3] = 255;
        }
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0); // width
  header.writeUInt32BE(side, 4); // height
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // compression
  header[11] = 0; // filter method
  header[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
