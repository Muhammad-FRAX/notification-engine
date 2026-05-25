import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM notification_deliveries WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listByNotification(notificationId) {
  const { rows } = await pool.query(
    'SELECT * FROM notification_deliveries WHERE notification_id = $1 ORDER BY created_at ASC',
    [notificationId]
  );
  return rows;
}

export async function listRetrying(maxAttempts) {
  const { rows } = await pool.query(
    `SELECT * FROM notification_deliveries
     WHERE status = 'retrying' AND attempts < $1
     ORDER BY created_at ASC`,
    [maxAttempts]
  );
  return rows;
}

export async function create({ notificationId, ruleId = null, groupId = null, recipientType, recipientId, status = 'queued' }) {
  const id = generateId('dlv_');
  const { rows } = await pool.query(
    `INSERT INTO notification_deliveries
       (id, notification_id, rule_id, group_id, recipient_type, recipient_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, notificationId, ruleId, groupId, recipientType, recipientId, status]
  );
  return rows[0];
}

const CAMEL_TO_SNAKE = {
  status: 'status',
  attempts: 'attempts',
  lastError: 'last_error',
  last_error: 'last_error',
  graphChatId: 'graph_chat_id',
  graph_chat_id: 'graph_chat_id',
  graphMessageId: 'graph_message_id',
  graph_message_id: 'graph_message_id',
  sentAt: 'sent_at',
  sent_at: 'sent_at',
};

export async function update(id, fields) {
  const setClauses = [];
  const params = [id];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const col = CAMEL_TO_SNAKE[key];
    if (!col) continue;
    params.push(value);
    setClauses.push(`${col} = $${params.length}`);
  }

  if (setClauses.length === 0) return null;

  const { rows } = await pool.query(
    `UPDATE notification_deliveries SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

export async function markSent(id, { graphChatId = null, graphMessageId = null } = {}) {
  const { rows } = await pool.query(
    `UPDATE notification_deliveries
     SET status = 'sent', sent_at = now(), graph_chat_id = $2, graph_message_id = $3
     WHERE id = $1
     RETURNING *`,
    [id, graphChatId, graphMessageId]
  );
  return rows[0] ?? null;
}

export async function markFailed(id, lastError) {
  const { rows } = await pool.query(
    `UPDATE notification_deliveries
     SET status = 'failed', last_error = $2
     WHERE id = $1
     RETURNING *`,
    [id, lastError]
  );
  return rows[0] ?? null;
}

export async function markRetrying(id) {
  const { rows } = await pool.query(
    `UPDATE notification_deliveries
     SET attempts = attempts + 1, status = 'retrying'
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

export async function resetForRetry(id) {
  const { rows } = await pool.query(
    `UPDATE notification_deliveries
     SET attempts = 0, status = 'retrying', last_error = NULL
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}
