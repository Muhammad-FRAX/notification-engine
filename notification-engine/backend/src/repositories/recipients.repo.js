import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM recipients_users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findUserByUpn(upn) {
  const { rows } = await pool.query('SELECT * FROM recipients_users WHERE upn = $1', [upn]);
  return rows[0] ?? null;
}

export async function listUsers() {
  const { rows } = await pool.query('SELECT * FROM recipients_users ORDER BY display_name ASC');
  return rows;
}

export async function createUser({ displayName, upn, aadUserId = null, notes = null }) {
  const id = generateId('usr_');
  const { rows } = await pool.query(
    `INSERT INTO recipients_users (id, display_name, upn, aad_user_id, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, displayName, upn, aadUserId, notes]
  );
  return rows[0];
}

export async function updateUser(id, { displayName, upn, aadUserId, notes }) {
  const { rows } = await pool.query(
    `UPDATE recipients_users
     SET display_name = COALESCE($2, display_name),
         upn          = COALESCE($3, upn),
         aad_user_id  = COALESCE($4, aad_user_id),
         notes        = COALESCE($5, notes)
     WHERE id = $1
     RETURNING *`,
    [id, displayName ?? null, upn ?? null, aadUserId ?? null, notes ?? null]
  );
  return rows[0] ?? null;
}

export async function removeUser(id) {
  await pool.query('DELETE FROM recipients_users WHERE id = $1', [id]);
}

export async function findChannelById(id) {
  const { rows } = await pool.query('SELECT * FROM recipients_channels WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listChannels() {
  const { rows } = await pool.query('SELECT * FROM recipients_channels ORDER BY display_name ASC');
  return rows;
}

export async function createChannel({ displayName, teamId, channelId, notes = null }) {
  const id = generateId('chn_');
  const { rows } = await pool.query(
    `INSERT INTO recipients_channels (id, display_name, team_id, channel_id, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, displayName, teamId, channelId, notes]
  );
  return rows[0];
}

export async function updateChannel(id, { displayName, notes }) {
  const { rows } = await pool.query(
    `UPDATE recipients_channels
     SET display_name = COALESCE($2, display_name),
         notes        = COALESCE($3, notes)
     WHERE id = $1
     RETURNING *`,
    [id, displayName ?? null, notes ?? null]
  );
  return rows[0] ?? null;
}

export async function removeChannel(id) {
  await pool.query('DELETE FROM recipients_channels WHERE id = $1', [id]);
}
