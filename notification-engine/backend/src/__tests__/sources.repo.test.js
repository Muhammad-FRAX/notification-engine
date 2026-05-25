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
  findAll,
  create,
  update,
  remove,
  touchLastUsed,
} from '../repositories/sources.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('sources.repo', () => {
  describe('findById', () => {
    it('returns row when found', async () => {
      const row = { id: 'src_1', name: 'Test' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await findById('src_1');
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['src_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await findById('src_missing');
      expect(result).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB connection failed'));
      await expect(findById('src_1')).rejects.toThrow('DB connection failed');
    });
  });

  describe('findAll', () => {
    it('returns all rows when activeOnly is false', async () => {
      const rows = [{ id: 'src_1' }, { id: 'src_2' }];
      pool.query.mockResolvedValue({ rows });
      const result = await findAll();
      expect(result).toEqual(rows);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).not.toContain('WHERE');
    });

    it('adds WHERE clause when activeOnly is true', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await findAll({ activeOnly: true });
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('WHERE active = true');
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('timeout'));
      await expect(findAll()).rejects.toThrow('timeout');
    });
  });

  describe('create', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'src_TEST', name: 'New Source', api_key_hash: 'hash', api_key_prefix: 'abc', rate_limit_rpm: 60 };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await create({ name: 'New Source', apiKeyHash: 'hash', apiKeyPrefix: 'abc' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['src_TEST', 'New Source', 'hash', 'abc', 60]
      );
    });

    it('uses provided rateLimitRpm', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await create({ name: 'S', apiKeyHash: 'h', apiKeyPrefix: 'p', rateLimitRpm: 120 });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['src_TEST', 'S', 'h', 'p', 120]);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('unique violation'));
      await expect(create({ name: 'S', apiKeyHash: 'h', apiKeyPrefix: 'p' })).rejects.toThrow('unique violation');
    });
  });

  describe('update', () => {
    it('returns updated row', async () => {
      const row = { id: 'src_1', name: 'Updated', rate_limit_rpm: 30, active: true };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await update('src_1', { name: 'Updated', rateLimitRpm: 30 });
      expect(result).toEqual(row);
    });

    it('returns null when row not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await update('src_missing', { name: 'X' });
      expect(result).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(update('src_1', { active: false })).rejects.toThrow('DB error');
    });
  });

  describe('remove', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(remove('src_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['src_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('FK violation'));
      await expect(remove('src_1')).rejects.toThrow('FK violation');
    });
  });

  describe('touchLastUsed', () => {
    it('executes UPDATE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(touchLastUsed('src_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['src_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(touchLastUsed('src_1')).rejects.toThrow('DB error');
    });
  });
});
