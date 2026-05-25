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
  listTemplates,
  create,
  update,
  remove,
} from '../repositories/templates.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('templates.repo', () => {
  describe('findById', () => {
    it('returns row when found', async () => {
      const row = { id: 'tpl_1', name: 'Alert', kind: 'text_html', body: '<b>hi</b>' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findById('tpl_1')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['tpl_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findById('tpl_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findById('tpl_1')).rejects.toThrow('DB error');
    });
  });

  describe('listTemplates', () => {
    it('returns all rows when activeOnly is false', async () => {
      const rows = [{ id: 'tpl_1' }, { id: 'tpl_2' }];
      pool.query.mockResolvedValue({ rows });
      const result = await listTemplates();
      expect(result).toEqual(rows);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).not.toContain('WHERE');
    });

    it('adds WHERE clause when activeOnly is true', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await listTemplates({ activeOnly: true });
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('WHERE active = true');
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('timeout'));
      await expect(listTemplates()).rejects.toThrow('timeout');
    });
  });

  describe('create', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'tpl_TEST', name: 'Alert', kind: 'text_html', body: '<b>hi</b>', vars_schema: null };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await create({ name: 'Alert', kind: 'text_html', body: '<b>hi</b>' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tpl_TEST', 'Alert', 'text_html', '<b>hi</b>', null]
      );
    });

    it('passes varsSchema when provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      const schema = { type: 'object' };
      await create({ name: 'A', kind: 'text_html', body: 'b', varsSchema: schema });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['tpl_TEST', 'A', 'text_html', 'b', schema]);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(create({ name: 'A', kind: 'text_html', body: 'b' })).rejects.toThrow('DB error');
    });
  });

  describe('update', () => {
    it('returns updated row', async () => {
      const row = { id: 'tpl_1', name: 'Updated', kind: 'text_html', version: 2 };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await update('tpl_1', { name: 'Updated' })).toEqual(row);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await update('tpl_missing', { name: 'X' })).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(update('tpl_1', { active: false })).rejects.toThrow('DB error');
    });
  });

  describe('remove', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(remove('tpl_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['tpl_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('FK violation'));
      await expect(remove('tpl_1')).rejects.toThrow('FK violation');
    });
  });
});
