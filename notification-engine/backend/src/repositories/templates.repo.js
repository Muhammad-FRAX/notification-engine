import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listTemplates({ activeOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM templates${activeOnly ? ' WHERE active = true' : ''} ORDER BY name ASC`
  );
  return rows;
}

export async function create({ name, kind, body, varsSchema = null }) {
  const id = generateId('tpl_');
  const { rows } = await pool.query(
    `INSERT INTO templates (id, name, kind, body, vars_schema)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, name, kind, body, varsSchema]
  );
  return rows[0];
}

export async function update(id, { name, kind, body, varsSchema, active }) {
  const { rows } = await pool.query(
    `UPDATE templates
     SET name        = COALESCE($2, name),
         kind        = COALESCE($3, kind),
         body        = COALESCE($4, body),
         vars_schema = COALESCE($5, vars_schema),
         active      = COALESCE($6, active),
         updated_at  = now(),
         version     = version + 1
     WHERE id = $1
     RETURNING *`,
    [id, name ?? null, kind ?? null, body ?? null, varsSchema ?? null, active ?? null]
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  await pool.query('DELETE FROM templates WHERE id = $1', [id]);
}
