import { config } from '../env.js';

/**
 * In-process rate limiting — no Redis, no dependency.
 *
 * A live domain is scanned within hours of the DNS record going live: the
 * public enquiry form is an open write endpoint and /api/admin/login accepts
 * unlimited password guesses. Both need a ceiling.
 *
 * Trade-offs, stated plainly:
 *   · Counters live in this process, so a multi-instance deploy gives each
 *     instance its own budget. For this store (one small web service) that is
 *     exactly right; if you ever scale out, move the Map to Redis.
 *   · The key is req.ip, which is only trustworthy when TRUST_PROXY matches the
 *     number of proxies in front of Node. See server/env.js.
 */

/** key → { count, resetAt }. Swept lazily so it cannot grow without bound. */
const buckets = new Map();
const MAX_TRACKED_KEYS = 10_000;

const sweep = (now) => {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

/**
 * Builds an express middleware. Fixed windows (not sliding) because the
 * behaviour at the boundary is easier to explain to a customer hitting it.
 */
export function createLimiter({ name, max, windowMs, message }) {
  return function rateLimit(req, res, next) {
    if (config.rateLimit.disabled) return next();

    const now = Date.now();
    sweep(now);

    // requireAdmin sets req.admin; login has no identity yet, so IP is the key.
    const identity = req.admin?.email || req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${name}:${identity}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(max - 1));
      return next();
    }

    bucket.count += 1;
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(max - bucket.count, 0)));

    if (bucket.count > max) {
      const retryAfter = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

const minutes = (windowMs) => Math.max(Math.round(windowMs / 60000), 1);

/** Public enquiry form — the endpoint strangers can write to. */
export const enquiryLimiter = createLimiter({
  name: 'enquiry',
  max: config.rateLimit.enquiryMax,
  windowMs: config.rateLimit.windowMs,
  message: `Too many enquiries from this connection. Please wait ${minutes(
    config.rateLimit.windowMs,
  )} minutes, or message us on WhatsApp directly.`,
});

/** Admin sign-in — stops unlimited password guessing. */
export const loginLimiter = createLimiter({
  name: 'login',
  max: config.rateLimit.loginMax,
  windowMs: config.rateLimit.windowMs,
  message: `Too many sign-in attempts. Please wait ${minutes(
    config.rateLimit.windowMs,
  )} minutes before trying again.`,
});

/** Reference-number lookup — stops enquiry enumeration by brute force. */
export const lookupLimiter = createLimiter({
  name: 'lookup',
  max: config.rateLimit.lookupMax,
  windowMs: config.rateLimit.windowMs,
  message: 'Too many lookups. Please wait a few minutes and try again.',
});

/** Test hook: forget every counter so one test cannot poison the next. */
export function resetLimiters() {
  buckets.clear();
}
