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
  listNotifications,
  create,
  update,
} from '../repositories/notifications.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('notifications.repo', () => {
  describe('findById', () => {
    it('returns row when found', async () => {
      const row = { id: 'ntf_1', event_type: 'deploy.done', status: 'sent' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findById('ntf_1')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['ntf_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findById('ntf_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findById('ntf_1')).rejects.toThrow('DB error');
    });
  });

  describe('listNotifications', () => {
    it('returns rows with no filters', async () => {
      const rows = [{ id: 'ntf_1' }];
      pool.query.mockResolvedValue({ rows });
      const result = await listNotifications();
      expect(result).toEqual(rows);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).not.toContain('WHERE');
      expect(params).toEqual([50, 0]);
    });

    it('adds status filter', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await listNotifications({ status: 'failed' });
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(params).toContain('failed');
    });

    it('adds sourceId filter', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await listNotifications({ sourceId: 'src_1' });
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(params).toContain('src_1');
    });

    it('respects limit and offset', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await listNotifications({ limit: 10, offset: 20 });
      const [, params] = pool.query.mock.calls[0];
      expect(params).toContain(10);
      expect(params).toContain(20);
    });

    it('combines multiple filters', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await listNotifications({ status: 'failed', sourceId: 'src_1', eventType: 'deploy.done' });
      const [, params] = pool.query.mock.calls[0];
      expect(params).toContain('failed');
      expect(params).toContain('src_1');
      expect(params).toContain('deploy.done');
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('timeout'));
      await expect(listNotifications()).rejects.toThrow('timeout');
    });
  });

  describe('create', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'ntf_TEST', source_id: 'src_1', event_type: 'deploy.done', status: 'queued' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await create({ sourceId: 'src_1', eventType: 'deploy.done', payload: { env: 'prod' } });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['ntf_TEST', 'src_1', 'deploy.done', expect.any(String), 'queued']
      );
    });

    it('uses provided status', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await create({ sourceId: 'src_1', eventType: 'e', payload: {}, status: 'sending' });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['ntf_TEST', 'src_1', 'e', expect.any(String), 'sending']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(create({ sourceId: 'src_1', eventType: 'e', payload: {} })).rejects.toThrow('DB error');
    });
  });

  describe('update', () => {
    it('returns updated row with snake_case keys', async () => {
      const row = { id: 'ntf_1', status: 'sent', recipient_count: 3 };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await update('ntf_1', { status: 'sent', recipient_count: 3 });
      expect(result).toEqual(row);
    });

    it('accepts camelCase keys and maps to snake_case columns', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await update('ntf_1', { matchedRules: ['rul_1'], recipientCount: 2 });
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('matched_rules');
      expect(sql).toContain('recipient_count');
    });

    it('skips undefined fields', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await update('ntf_1', { status: 'sent', recipientCount: undefined });
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('status');
      expect(sql).not.toContain('recipient_count');
    });

    it('returns null when row not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await update('ntf_missing', { status: 'failed' })).toBeNull();
    });

    it('returns null when no valid fields provided', async () => {
      const result = await update('ntf_1', { unknownField: 'x' });
      expect(result).toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(update('ntf_1', { status: 'failed' })).rejects.toThrow('DB error');
    });
  });
});
