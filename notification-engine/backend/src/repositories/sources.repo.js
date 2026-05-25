import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM sources WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findAll({ activeOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM sources${activeOnly ? ' WHERE active = true' : ''} ORDER BY created_at ASC`
  );
  return rows;
}

export async function create({ name, apiKeyHash, apiKeyPrefix, rateLimitRpm = 60 }) {
  const id = generateId('src_');
  const { rows } = await pool.query(
    `INSERT INTO sources (id, name, api_key_hash, api_key_prefix, rate_limit_rpm)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, name, apiKeyHash, apiKeyPrefix, rateLimitRpm]
  );
  return rows[0];
}

export async function update(id, { name, rateLimitRpm, active }) {
  const { rows } = await pool.query(
    `UPDATE sources
     SET name           = COALESCE($2, name),
         rate_limit_rpm = COALESCE($3, rate_limit_rpm),
         active         = COALESCE($4, active)
     WHERE id = $1
     RETURNING *`,
    [id, name ?? null, rateLimitRpm ?? null, active ?? null]
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  await pool.query('DELETE FROM sources WHERE id = $1', [id]);
}

export async function touchLastUsed(id) {
  await pool.query('UPDATE sources SET last_used_at = now() WHERE id = $1', [id]);
}
