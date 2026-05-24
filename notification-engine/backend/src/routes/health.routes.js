import { Router } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../db/pool.js';
import config from '../config.js';

const router = Router();

router.get('/api/health', async (req, res) => {
  let db = 'down';
  try {
    await pool.query('SELECT 1');
    db = 'up';
  } catch {
    // db stays 'down'
  }

  const cachePath = join(config.msalCacheDir, '.msal-cache.json');
  const msal = existsSync(cachePath) ? 'signed_in' : 'signed_out';

  const ok = db === 'up';
  res.status(ok ? 200 : 503).json({ ok, db, msal });
});

export default router;
