import fs from 'node:fs';
import path from 'node:path';
import { config, dbMode, projectRoot, serverRoot } from './env.js';

let pool;
let engine;

/**
 * Boots a Postgres connection. With DATABASE_URL set we connect to the real
 * database (Supabase free tier, Neon, local Postgres...). Without it we spin up
 * an in-memory Postgres so the whole app is runnable with zero signup.
 */
export async function initDb() {
  if (pool) return { pool, engine };

  if (dbMode === 'postgres') {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
      max: 8,
    });
    engine = 'postgres';
    await pool.query('select 1');
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
