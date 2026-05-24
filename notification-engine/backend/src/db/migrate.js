import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const { default: config } = await import('../config.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations() {
  const { run } = await import('node-pg-migrate');
  await run({
    databaseUrl: config.databaseUrl,
    migrationsTable: 'pgmigrations',
    direction: 'up',
    dir: join(__dirname, '../../../migrations'),
    checkOrder: true,
    log: (msg) => console.log('[migrate]', msg),
  });
}

// Run directly when invoked as a script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runMigrations()
    .then(() => { console.log('[migrate] all migrations applied'); process.exit(0); })
    .catch((err) => { console.error('[migrate] failed:', err.message); process.exit(1); });
}
