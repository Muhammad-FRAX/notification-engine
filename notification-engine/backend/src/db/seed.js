import dotenv from 'dotenv';
dotenv.config();

import { pool } from './pool.js';
import { generateId } from '../util/ulid.js';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Source
    const rawKey = randomBytes(32).toString('hex');
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = await argon2.hash(rawKey);
    const sourceId = generateId('src_');

    await client.query(
      `INSERT INTO sources (id, name, api_key_hash, api_key_prefix, rate_limit_rpm)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [sourceId, 'smoke-test-source', keyHash, keyPrefix, 60]
    );

    // Recipient user
    const userId = generateId('usr_');
    await client.query(
      `INSERT INTO recipients_users (id, display_name, upn)
       VALUES ($1, $2, $3)
       ON CONFLICT (upn) DO NOTHING`,
      [userId, 'Smoke Test User', 'smoke@example.com']
    );

    // Group
    const groupId = generateId('grp_');
    await client.query(
      `INSERT INTO groups (id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [groupId, 'smoke-test-group', 'Created by seed script']
    );

    // Group member — link the user into the group
    const memberId = generateId('mbr_');
    await client.query(
      `INSERT INTO group_members (id, group_id, member_type, member_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [memberId, groupId, 'user', userId]
    );

    // Template
    const templateId = generateId('tpl_');
    await client.query(
      `INSERT INTO templates (id, name, kind, body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        templateId,
        'smoke-default',
        'text_html',
        '<b>{{title}}</b><br>{{body}}',
      ]
    );

    // Routing rule
    const ruleId = generateId('rul_');
    await client.query(
      `INSERT INTO routing_rules (id, source_id, event_pattern, group_id, template_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [ruleId, sourceId, 'smoke.*', groupId, templateId, 100]
    );

    await client.query('COMMIT');

    console.log('[seed] done');
    console.log('[seed] source id :', sourceId);
    console.log('[seed] api key    :', rawKey, '  <-- shown once, not stored');
    console.log('[seed] user id    :', userId);
    console.log('[seed] group id   :', groupId);
    console.log('[seed] template id:', templateId);
    console.log('[seed] rule id    :', ruleId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[seed] failed:', err.message); process.exit(1); });
