import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseHost, describeConnectionFailure, withConnectionRetry } from '../db.js';

/**
 * A failing DNS lookup used to stop the API from booting (and, under
 * `node --watch`, to loop), so the first connection is retried and the error
 * names the host plus what to check. These cases pin both behaviours down.
 */

const error = (code, message = code) => Object.assign(new Error(message), { code });

test('databaseHost reads the host out of a connection string without credentials', () => {
  assert.equal(databaseHost('postgresql://postgres.abc:secret@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'), 'aws-0-ap-northeast-2.pooler.supabase.com');
  assert.equal(databaseHost('postgres://localhost:5432/shop'), 'localhost');
  assert.equal(databaseHost(''), '');
});

test('a transient DNS failure is retried until it succeeds', async () => {
  let calls = 0;
  const result = await withConnectionRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw error('ENOTFOUND', 'getaddrinfo ENOTFOUND db.example.com');
      return 'connected';
    },
    { attempts: 4, delayMs: 1 },
  );

  assert.equal(result, 'connected');
  assert.equal(calls, 3, 'the third attempt is the one that gets through');
});

test('retrying gives up after the last attempt and reports how often it tried', async () => {
  let calls = 0;
  const retries = [];
  await assert.rejects(
    withConnectionRetry(
      async () => {
        calls += 1;
        throw error('EAI_AGAIN', 'getaddrinfo EAI_AGAIN db.example.com');
      },
      { attempts: 3, delayMs: 1, onRetry: (info) => retries.push(info.tries) },
    ),
    /EAI_AGAIN/,
  );

  assert.equal(calls, 3);
  assert.deepEqual(retries, [2, 3], 'it announces each retry before making it');
});

test('a rejected password is not retried — the answer will not change', async () => {
  let calls = 0;
  await assert.rejects(
    withConnectionRetry(
      async () => {
        calls += 1;
        throw error('28P01', 'password authentication failed for user "postgres"');
      },
      { attempts: 4, delayMs: 1 },
    ),
    /password authentication/,
  );

  assert.equal(calls, 1);
});

test('the failure message names the host and says what to check', () => {
  const host = 'aws-0-ap-northeast-2.pooler.supabase.com';

  const dns = describeConnectionFailure(error('ENOTFOUND', `getaddrinfo ENOTFOUND ${host}`), host);
  assert.match(dns.message, new RegExp(host));
  assert.ok(dns.hints.some((hint) => /could not be resolved/i.test(hint)), 'says it is DNS, not the password');
  assert.ok(dns.hints.some((hint) => /flushdns|dscacheutil/.test(hint)), 'suggests flushing the resolver cache');
  assert.ok(dns.hints.some((hint) => /paused/i.test(hint)), 'mentions a paused Supabase project');

  const refused = describeConnectionFailure(error('ECONNREFUSED'), host);
  assert.ok(refused.hints.some((hint) => /5432|6543/.test(hint)), 'names the pooler ports');

  const auth = describeConnectionFailure(error('28P01', 'password authentication failed'), host);
  assert.ok(auth.hints.some((hint) => /URL-encode/i.test(hint)), 'explains password encoding');
});
