import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/sources.repo.js', () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../util/hash.js', () => ({
  hashApiKey: vi.fn(async (key) => `hash:${key}`),
}));

import * as repo from '../repositories/sources.repo.js';
import { list, getOne, create, update, remove } from '../controllers/admin/sources.controller.js';
import { HttpError } from '../util/HttpError.js';

function makeReq(opts = {}) {
  return { body: opts.body ?? {}, params: opts.params ?? {}, query: opts.query ?? {} };
}

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('sources controller', () => {
  describe('list', () => {
    it('returns all sources', async () => {
      const rows = [{ id: 'src_1' }];
      repo.findAll.mockResolvedValue(rows);
      const res = makeRes();
      await list(makeReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('propagates repo error', async () => {
      repo.findAll.mockRejectedValue(new Error('DB down'));
      const next = vi.fn();
      await list(makeReq(), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB down');
    });
  });

  describe('getOne', () => {
    it('returns source when found', async () => {
      const row = { id: 'src_1', name: 'Zabbix' };
      repo.findById.mockResolvedValue(row);
      const res = makeRes();
      await getOne(makeReq({ params: { id: 'src_1' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'src_missing' } }), makeRes(), next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates repo error', async () => {
      repo.findById.mockRejectedValue(new Error('timeout'));
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'src_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('timeout');
    });
  });

  describe('create', () => {
    it('creates source and returns row with api_key', async () => {
      const row = { id: 'src_TEST', name: 'New', api_key_hash: 'hash:x', api_key_prefix: 'x' };
      repo.create.mockResolvedValue(row);
      const res = makeRes();
      await create(makeReq({ body: { name: 'New' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      const result = res.json.mock.calls[0][0];
      expect(result.api_key).toBeDefined();
      expect(typeof result.api_key).toBe('string');
      expect(result.api_key.length).toBe(64);
    });

    it('passes 400 when name is missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: {} }), makeRes(), next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
      expect(next.mock.calls[0][0].status).toBe(400);
      expect(next.mock.calls[0][0].code).toBe('invalid_body');
    });

    it('propagates repo error', async () => {
      repo.create.mockRejectedValue(new Error('unique violation'));
      const next = vi.fn();
      await create(makeReq({ body: { name: 'Dup' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('unique violation');
    });
  });

  describe('update', () => {
    it('returns updated source', async () => {
      const row = { id: 'src_1', name: 'Updated' };
      repo.update.mockResolvedValue(row);
      const res = makeRes();
      await update(makeReq({ params: { id: 'src_1' }, body: { name: 'Updated' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.update.mockResolvedValue(null);
      const next = vi.fn();
      await update(makeReq({ params: { id: 'src_missing' }, body: { active: false } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates repo error', async () => {
      repo.update.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await update(makeReq({ params: { id: 'src_1' }, body: { active: false } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('remove', () => {
    it('returns 204 on success', async () => {
      repo.findById.mockResolvedValue({ id: 'src_1' });
      repo.remove.mockResolvedValue();
      const res = makeRes();
      await remove(makeReq({ params: { id: 'src_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('passes 404 when source not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'src_missing' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates repo error on remove', async () => {
      repo.findById.mockResolvedValue({ id: 'src_1' });
      repo.remove.mockRejectedValue(new Error('FK violation'));
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'src_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('FK violation');
    });
  });
});
