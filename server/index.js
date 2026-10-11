import { config, dbMode, storageMode } from './env.js';
import { initDb, closeDb } from './db.js';
import { ensureAdminUser } from './auth.js';
import { ensureCollections, ensureContent, seedDemoData, databaseSummary } from './seed.js';
import { createApp } from './app.js';

async function main() {
  await initDb();
  const admin = await ensureAdminUser();
  const collections = await ensureCollections();
  const seed = config.seedDemo ? await seedDemoData() : { seeded: false };
  if (config.seedDemo) await ensureContent();
  const summary = await databaseSummary();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log('');
    console.log(`  ${config.store.name} API is live → http://localhost:${config.port}`);
    console.log(`  ├─ database       ${dbMode}${dbMode === 'memory' ? ' (in-memory, resets on restart)' : ''}`);
    console.log(`  ├─ image storage  ${storageMode}`);
    console.log(`  ├─ catalogue      ${summary.products} products · ${summary.collections} collections`);
    console.log(`  ├─ seeded demo    ${seed.seeded ? 'yes' : 'no (catalogue already has data)'}`);
    console.log(`  └─ admin login    ${config.adminEmail} / ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : config.adminPassword}`);
    console.log('');
  });

  const shutdown = async () => {
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error(`[api] Failed to start API: ${error.message}`);
  // db.js turns a driver error into the checks that actually apply to it.
  for (const hint of error.hints || []) console.error(`[api]   · ${hint}`);
  if (dbMode === 'postgres') {
    console.error('[api] Fix DATABASE_URL in server/.env — or leave it empty to run on in-memory Postgres.');
  }
  await closeDb().catch(() => {});
  process.exit(1);
});
