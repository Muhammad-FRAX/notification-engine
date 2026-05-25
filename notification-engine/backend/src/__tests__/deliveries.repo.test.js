import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../util/ulid.js', () => ({
  generateId: vi.fn((prefix) => `${prefix}TEST`),
}));

import { pool } from '../db/pool.js';
import {
  findById,
  listByNotification,
  listRetrying,
  create,
  update,
  markSent,
  markFailed,
  markRetrying,
  resetForRetry,
} from '../repositories/deliveries.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('deliveries.repo', () => {
  describe('findById', () => {
    it('returns row when found', async () => {
      const row = { id: 'dlv_1', notification_id: 'ntf_1', status: 'queued' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findById('dlv_1')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findById('dlv_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findById('dlv_1')).rejects.toThrow('DB error');
    });
  });

  describe('listByNotification', () => {
    it('returns rows for notification ordered by created_at', async () => {
      const rows = [{ id: 'dlv_1' }, { id: 'dlv_2' }];
      pool.query.mockResolvedValue({ rows });
      expect(await listByNotification('ntf_1')).toEqual(rows);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['ntf_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(listByNotification('ntf_1')).rejects.toThrow('DB error');
    });
  });

  describe('listRetrying', () => {
    it('returns rows with status=retrying and attempts < maxAttempts', async () => {
      const rows = [{ id: 'dlv_1', status: 'retrying', attempts: 1 }];
      pool.query.mockResolvedValue({ rows });
      const result = await listRetrying(3);
      expect(result).toEqual(rows);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [3]);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(listRetrying(3)).rejects.toThrow('DB error');
    });
  });

  describe('create', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'dlv_TEST', notification_id: 'ntf_1', recipient_type: 'user', recipient_id: 'usr_1', status: 'queued' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await create({ notificationId: 'ntf_1', recipientType: 'user', recipientId: 'usr_1' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['dlv_TEST', 'ntf_1', null, null, 'user', 'usr_1', 'queued']
      );
    });

    it('passes ruleId and groupId when provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await create({ notificationId: 'ntf_1', ruleId: 'rul_1', groupId: 'grp_1', recipientType: 'user', recipientId: 'usr_1' });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_TEST', 'ntf_1', 'rul_1', 'grp_1', 'user', 'usr_1', 'queued']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(create({ notificationId: 'ntf_1', recipientType: 'user', recipientId: 'usr_1' })).rejects.toThrow('DB error');
    });
  });

  describe('update', () => {
    it('returns updated row with snake_case keys', async () => {
      const row = { id: 'dlv_1', status: 'sent' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await update('dlv_1', { status: 'sent' })).toEqual(row);
    });

    it('accepts camelCase keys and maps to snake_case columns', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await update('dlv_1', { lastError: 'timeout', graphChatId: 'chat-1', graphMessageId: 'msg-1' });
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('last_error');
      expect(sql).toContain('graph_chat_id');
      expect(sql).toContain('graph_message_id');
    });

    it('skips undefined fields', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await update('dlv_1', { status: 'failed', graphChatId: undefined });
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('status');
      expect(sql).not.toContain('graph_chat_id');
    });

    it('returns null when row not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await update('dlv_missing', { status: 'sent' })).toBeNull();
    });

    it('returns null when no valid fields provided', async () => {
      const result = await update('dlv_1', { unknownField: 'x' });
      expect(result).toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('markSent', () => {
    it('sets status to sent with timestamps and graph ids', async () => {
      const row = { id: 'dlv_1', status: 'sent', graph_chat_id: 'chat-1', graph_message_id: 'msg-1' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await markSent('dlv_1', { graphChatId: 'chat-1', graphMessageId: 'msg-1' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_1', 'chat-1', 'msg-1']);
    });

    it('uses nulls when no graph ids provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await markSent('dlv_1');
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_1', null, null]);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(markSent('dlv_1')).rejects.toThrow('DB error');
    });
  });

  describe('markFailed', () => {
    it('sets status to failed with last_error', async () => {
      const row = { id: 'dlv_1', status: 'failed', last_error: 'timeout' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await markFailed('dlv_1', 'timeout');
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_1', 'timeout']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(markFailed('dlv_1', 'err')).rejects.toThrow('DB error');
    });
  });

  describe('markRetrying', () => {
    it('increments attempts and sets status to retrying', async () => {
      const row = { id: 'dlv_1', status: 'retrying', attempts: 2 };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await markRetrying('dlv_1');
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_1']);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('attempts + 1');
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(markRetrying('dlv_1')).rejects.toThrow('DB error');
    });
  });

  describe('resetForRetry', () => {
    it('resets attempts to 0, status to retrying, clears last_error', async () => {
      const row = { id: 'dlv_1', status: 'retrying', attempts: 0, last_error: null };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await resetForRetry('dlv_1');
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['dlv_1']);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('attempts = 0');
      expect(sql).toContain("status = 'retrying'");
      expect(sql).toContain('last_error = NULL');
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(resetForRetry('dlv_1')).rejects.toThrow('DB error');
    });
  });
});
