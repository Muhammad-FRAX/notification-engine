import { Router } from 'express';
import { pool } from '../db/pool.js';
import { getProxyAccount } from '../repositories/proxyAccount.repo.js';

const router = Router();

router.get('/api/health', async (req, res) => {
  let db = 'down';
  let msal = 'signed_out';

  try {
    await pool.query('SELECT 1');
    db = 'up';

    const proxyAccount = await getProxyAccount();
    if (proxyAccount?.status === 'signed_in') {
      msal = 'signed_in';
    }
  } catch {
    // db stays 'down', msal stays 'signed_out'
  }

  const ok = db === 'up';
  res.status(ok ? 200 : 503).json({ ok, db, msal });
});

export default router;
