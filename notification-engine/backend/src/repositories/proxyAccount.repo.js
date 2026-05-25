import { pool } from '../db/pool.js';

export async function getProxyAccount() {
  const { rows } = await pool.query('SELECT * FROM proxy_account WHERE id = 1');
  return rows[0] ?? null;
}

export async function setProxyAccount({ upn, aadUserId, displayName, cachePath, lastSignInAt, status }) {
  const { rows } = await pool.query(
    `UPDATE proxy_account
     SET upn = $1, aad_user_id = $2, display_name = $3,
         cache_path = $4, last_sign_in_at = $5, status = $6
     WHERE id = 1
     RETURNING *`,
    [upn, aadUserId, displayName, cachePath, lastSignInAt, status]
  );
  return rows[0];
}

export async function setProxyAccountStatus(status) {
  const { rows } = await pool.query(
    'UPDATE proxy_account SET status = $1 WHERE id = 1 RETURNING *',
    [status]
  );
  return rows[0];
}
