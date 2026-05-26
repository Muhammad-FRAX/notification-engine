import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listNotifications({ status, sourceId, eventType, from, to, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (status !== undefined) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (sourceId !== undefined) {
    params.push(sourceId);
    conditions.push(`source_id = $${params.length}`);
  }
  if (eventType !== undefined) {
    params.push(eventType);
    conditions.push(`event_type = $${params.length}`);
  }
  if (from !== undefined) {
    params.push(from);
    conditions.push(`received_at >= $${params.length}`);
  }
  if (to !== undefined) {
    params.push(to);
    conditions.push(`received_at <= $${params.length}`);
  }

  params.push(limit);
  params.push(offset);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM notifications
     ${where}
     ORDER BY received_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

export async function create({ sourceId, eventType, payload, status = 'queued' }) {
  const id = generateId('ntf_');
  const { rows } = await pool.query(
    `INSERT INTO notifications (id, source_id, event_type, payload, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, sourceId, eventType, JSON.stringify(payload), status]
  );
  return rows[0];
}

export async function getStats() {
  const { rows: statusRows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM notifications GROUP BY status`
  );
  const { rows: retryRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notification_deliveries WHERE status = 'retrying'`
  );

  const byStatus = {};
  let total = 0;
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
    total += row.count;
  }

  return {
    notifications: { total, by_status: byStatus },
    deliveries: { retrying: retryRows[0]?.count ?? 0 },
  };
}

const CAMEL_TO_SNAKE = {
  status: 'status',
  matchedRules: 'matched_rules',
  matched_rules: 'matched_rules',
  recipientCount: 'recipient_count',
  recipient_count: 'recipient_count',
  error: 'error',
};

// Columns of jsonb type — values must be JSON.stringify'd before binding,
// otherwise node-postgres serializes JS arrays as PG array literals ({...}).
const JSON_COLUMNS = new Set(['matched_rules']);

export async function update(id, fields) {
  const setClauses = [];
  const params = [id];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const col = CAMEL_TO_SNAKE[key];
    if (!col) continue;
    params.push(JSON_COLUMNS.has(col) ? JSON.stringify(value) : value);
    setClauses.push(`${col} = $${params.length}`);
  }

  if (setClauses.length === 0) return null;

  const { rows } = await pool.query(
    `UPDATE notifications SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] ?? null;
}
