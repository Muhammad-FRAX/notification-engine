import { pool } from '../db/pool.js';
import { generateId } from '../util/ulid.js';

export async function findGroupById(id) {
  const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listGroups() {
  const { rows } = await pool.query('SELECT * FROM groups ORDER BY name ASC');
  return rows;
}

export async function createGroup({ name, description = null }) {
  const id = generateId('grp_');
  const { rows } = await pool.query(
    `INSERT INTO groups (id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, name, description]
  );
  return rows[0];
}

export async function updateGroup(id, { name, description }) {
  const { rows } = await pool.query(
    `UPDATE groups
     SET name        = COALESCE($2, name),
         description = COALESCE($3, description),
         updated_at  = now()
     WHERE id = $1
     RETURNING *`,
    [id, name ?? null, description ?? null]
  );
  return rows[0] ?? null;
}

export async function removeGroup(id) {
  await pool.query('DELETE FROM groups WHERE id = $1', [id]);
}

export async function listMembers(groupId) {
  const { rows } = await pool.query(
    'SELECT * FROM group_members WHERE group_id = $1 ORDER BY created_at ASC',
    [groupId]
  );
  return rows;
}

export async function addMember({ groupId, memberType, memberId }) {
  const id = generateId('mbr_');
  const { rows } = await pool.query(
    `INSERT INTO group_members (id, group_id, member_type, member_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (group_id, member_type, member_id) DO NOTHING
     RETURNING *`,
    [id, groupId, memberType, memberId]
  );
  if (rows[0]) return rows[0];
  const { rows: existing } = await pool.query(
    'SELECT * FROM group_members WHERE group_id = $1 AND member_type = $2 AND member_id = $3',
    [groupId, memberType, memberId]
  );
  return existing[0];
}

export async function removeMember(groupId, memberType, memberId) {
  await pool.query(
    'DELETE FROM group_members WHERE group_id = $1 AND member_type = $2 AND member_id = $3',
    [groupId, memberType, memberId]
  );
}
