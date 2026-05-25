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
  listRules,
  listActiveBySource,
  create,
  update,
  remove,
} from '../repositories/rules.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('rules.repo', () => {
  describe('findById', () => {
    it('returns row when found', async () => {
      const row = { id: 'rul_1', source_id: 'src_1', event_pattern: '*.alert' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findById('rul_1')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['rul_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findById('rul_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findById('rul_1')).rejects.toThrow('DB error');
    });
  });

  describe('listRules', () => {
    it('returns all rules when no sourceId given', async () => {
      const rows = [{ id: 'rul_1' }, { id: 'rul_2' }];
      pool.query.mockResolvedValue({ rows });
      const result = await listRules();
      expect(result).toEqual(rows);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).not.toContain('WHERE');
    });

    it('filters by sourceId when provided', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await listRules({ sourceId: 'src_1' });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['src_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('timeout'));
      await expect(listRules()).rejects.toThrow('timeout');
    });
  });

  describe('listActiveBySource', () => {
    it('returns active rows for source ordered by priority', async () => {
      const rows = [{ id: 'rul_1', active: true, priority: 10 }];
      pool.query.mockResolvedValue({ rows });
      const result = await listActiveBySource('src_1');
      expect(result).toEqual(rows);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['src_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(listActiveBySource('src_1')).rejects.toThrow('DB error');
    });
  });

  describe('create', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'rul_TEST', source_id: 'src_1', event_pattern: '*.alert', group_id: 'grp_1', template_id: null, priority: 100 };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await create({ sourceId: 'src_1', eventPattern: '*.alert', groupId: 'grp_1' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['rul_TEST', 'src_1', '*.alert', 'grp_1', null, 100]
      );
    });

    it('passes templateId and priority when provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await create({ sourceId: 'src_1', eventPattern: '*.alert', groupId: 'grp_1', templateId: 'tpl_1', priority: 50 });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['rul_TEST', 'src_1', '*.alert', 'grp_1', 'tpl_1', 50]);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(create({ sourceId: 'src_1', eventPattern: '*.alert', groupId: 'grp_1' })).rejects.toThrow('DB error');
    });
  });

  describe('update', () => {
    it('returns updated row', async () => {
      const row = { id: 'rul_1', active: false };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await update('rul_1', { active: false })).toEqual(row);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await update('rul_missing', { active: false })).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(update('rul_1', { priority: 10 })).rejects.toThrow('DB error');
    });
  });

  describe('remove', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(remove('rul_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['rul_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('FK violation'));
      await expect(remove('rul_1')).rejects.toThrow('FK violation');
    });
  });
});
