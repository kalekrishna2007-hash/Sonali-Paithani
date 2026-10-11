import fs from 'node:fs';
import path from 'node:path';
import { config, dbMode, projectRoot, serverRoot } from './env.js';

let pool;
let engine;

const CONNECT_ATTEMPTS = 4;
const CONNECT_DELAY_MS = 800;

/**
 * Failures that are worth retrying: the network or the name resolver hiccuped,
 * rather than the database rejecting us. A laptop waking from sleep, a VPN
 * switching or a resolver answering NXDOMAIN once all look like this.
 */
const TRANSIENT = /ENOTFOUND|EAI_AGAIN|EAI_FAIL|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EPIPE|CONNECTION_ENDED|57P01|57P02|57P03/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The host from a connection string, without credentials. */
export function databaseHost(connectionString = '') {
  const value = String(connectionString).trim();
  if (!value) return '';
  // Credentials can contain an '@', so split on the last one.
  const withoutCredentials = value.includes('@') ? value.slice(value.lastIndexOf('@') + 1) : value;
  return withoutCredentials.replace(/^[a-z+]+:\/\//i, '').split(/[/:?#]/)[0] || '';
}

/**
 * Turns a raw driver error into something that names the host and says what to
 * check — the difference between "ENOTFOUND" and knowing it is DNS, not the
 * password.
 */
export function describeConnectionFailure(error, host = '') {
  const code = error?.code || '';
  const target = host || 'the database';
  const hints = [];

  if (/ENOTFOUND|EAI_AGAIN|EAI_FAIL/.test(code) || /getaddrinfo|ENOTFOUND/i.test(error?.message || '')) {
    hints.push(`the name "${target}" could not be resolved, so this is DNS/network, not the password`);
    hints.push('check you are online, run `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (macOS), and confirm the host is still the one the Supabase Connect dialog shows');
    hints.push('a Supabase project that has been paused stops answering its hostname — resume it in the dashboard');
  } else if (/ECONNREFUSED/.test(code)) {
    hints.push(`nothing accepted a connection on ${target} — for the Supabase pooler use port 5432 (session) or 6543 (transaction)`);
  } else if (/ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ECONNRESET/.test(code)) {
    hints.push(`${target} did not answer — the network or a firewall is blocking the connection`);
  } else if (/password authentication|28P01|invalid_password|SASL/i.test(`${code} ${error?.message || ''}`)) {
    hints.push('the password in DATABASE_URL was rejected — URL-encode any @ : / or # it contains');
  } else if (/does not exist|3D000/i.test(`${code} ${error?.message || ''}`)) {
    hints.push('that database name does not exist on this server');
  }

  const failure = new Error(`Could not connect to ${target}: ${error?.message || 'unknown error'}`);
  failure.code = code;
  failure.hints = hints;
  failure.cause = error;
  return failure;
}

/**
 * Runs `attempt` until it succeeds, retrying only transient failures.
 *
 * The hostname is resolved once per boot, so a single DNS hiccup used to be
 * enough to stop the API from starting (and, under `node --watch`, to loop).
 */
export async function withConnectionRetry(attempt, options = {}) {
  const attempts = options.attempts || CONNECT_ATTEMPTS;
  const baseDelay = options.delayMs ?? CONNECT_DELAY_MS;
  const onRetry = options.onRetry;
  let lastError;

  for (let tries = 1; tries <= attempts; tries += 1) {
    try {
      return await attempt(tries);
    } catch (error) {
      lastError = error;
      const transient = TRANSIENT.test(error?.code || '') || TRANSIENT.test(error?.message || '');
      if (!transient || tries === attempts) break;
      const wait = baseDelay * 2 ** (tries - 1);
      onRetry?.({ error, tries: tries + 1, attempts, wait });
      await sleep(wait);
    }
  }

  throw lastError;
}

/**
 * Boots a Postgres connection. With DATABASE_URL set we connect to the real
 * database (Supabase free tier, Neon, local Postgres...). Without it we spin up
 * an in-memory Postgres so the whole app is runnable with zero signup.
 */
export async function initDb() {
  if (pool) return { pool, engine };

  if (dbMode === 'postgres') {
    const { Pool } = await import('pg');
    const host = databaseHost(config.databaseUrl);
    engine = 'postgres';
    try {
      await withConnectionRetry(
        async () => {
          const candidate = new Pool({
            connectionString: config.databaseUrl,
            ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
            max: 8,
          });
          try {
            await candidate.query('select 1');
            pool = candidate;
          } catch (error) {
            await candidate.end().catch(() => {});
            throw error;
          }
        },
        {
          onRetry: ({ error, tries, attempts, wait }) =>
            console.warn(
              `[db] ${host} did not answer (${error.code || error.message}) — retrying in ${wait}ms (attempt ${tries}/${attempts})`,
            ),
        },
      );
    } catch (error) {
      throw describeConnectionFailure(error, host);
    }
  } else {
    let newDb;
    try {
      ({ newDb } = await import('pg-mem'));
    } catch {
      // pg-mem is a devDependency, so a production install (npm ci --omit=dev)
      // does not have it. Say why instead of "Cannot find module".
      throw new Error(
        'DATABASE_URL is empty and the in-memory database engine (pg-mem) is not installed. ' +
          'Set DATABASE_URL in server/.env — production builds run without pg-mem on purpose.',
      );
    }
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    const adapter = mem.adapters.createPg();
    pool = new adapter.Pool();
    engine = 'memory';
  }

  await applySchema();
  return { pool, engine };
}

async function applySchema() {
  const sql = fs.readFileSync(path.join(serverRoot, 'schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = undefined;
}

/** Run a query and return the rows. */
export async function q(text, params = []) {
  if (!pool) throw new Error('Database not initialised — call initDb() first');
  const result = await pool.query(text, params);
  return result.rows;
}

/** Run a query and return the first row (or undefined). */
export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0];
}

/** Run several statements inside a transaction. */
export async function tx(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const scoped = {
      q: async (text, params = []) => (await client.query(text, params)).rows,
      one: async (text, params = []) => (await client.query(text, params)).rows[0],
    };
    const result = await work(scoped);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      /* connection already gone */
    }
    throw error;
  } finally {
    client.release();
  }
}

export const uploadsDir = path.join(projectRoot, 'uploads');
