import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM routing_rules WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listRules({ sourceId = null } = {}) {
  if (sourceId) {
    const { rows } = await pool.query(
      'SELECT * FROM routing_rules WHERE source_id = $1 ORDER BY priority ASC, created_at ASC',
      [sourceId]
    );
    return rows;
  }
  const { rows } = await pool.query(
    'SELECT * FROM routing_rules ORDER BY priority ASC, created_at ASC'
  );
  return rows;
}

export async function listActiveBySource(sourceId) {
  const { rows } = await pool.query(
    `SELECT * FROM routing_rules
     WHERE source_id = $1 AND active = true
     ORDER BY priority ASC`,
    [sourceId]
  );
  return rows;
}

export async function create({ sourceId, eventPattern, groupId, templateId = null, priority = 100 }) {
  const id = generateId('rul_');
  const { rows } = await pool.query(
    `INSERT INTO routing_rules (id, source_id, event_pattern, group_id, template_id, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, sourceId, eventPattern, groupId, templateId, priority]
  );
  return rows[0];
}

export async function update(id, { eventPattern, groupId, templateId, priority, active }) {
  const { rows } = await pool.query(
    `UPDATE routing_rules
     SET event_pattern = COALESCE($2, event_pattern),
         group_id      = COALESCE($3, group_id),
         template_id   = COALESCE($4, template_id),
         priority      = COALESCE($5, priority),
         active        = COALESCE($6, active)
     WHERE id = $1
     RETURNING *`,
    [id, eventPattern ?? null, groupId ?? null, templateId ?? null, priority ?? null, active ?? null]
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  await pool.query('DELETE FROM routing_rules WHERE id = $1', [id]);
}
