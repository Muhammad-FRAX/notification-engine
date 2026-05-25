import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/rules.repo.js', () => ({
  listRules: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

import * as repo from '../repositories/rules.repo.js';
import { list, getOne, create, update, remove } from '../controllers/admin/rules.controller.js';
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

describe('rules controller', () => {
  describe('list', () => {
    it('returns all rules', async () => {
      const rows = [{ id: 'rul_1' }];
      repo.listRules.mockResolvedValue(rows);
      const res = makeRes();
      await list(makeReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rows);
      expect(repo.listRules).toHaveBeenCalledWith({ sourceId: null });
    });

    it('filters by source_id when provided', async () => {
      repo.listRules.mockResolvedValue([]);
      const res = makeRes();
      await list(makeReq({ query: { source_id: 'src_1' } }), res, vi.fn());
      expect(repo.listRules).toHaveBeenCalledWith({ sourceId: 'src_1' });
    });

    it('propagates error', async () => {
      repo.listRules.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await list(makeReq(), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('getOne', () => {
    it('returns rule when found', async () => {
      const row = { id: 'rul_1', event_pattern: 'kpi.*' };
      repo.findById.mockResolvedValue(row);
      const res = makeRes();
      await getOne(makeReq({ params: { id: 'rul_1' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'rul_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findById.mockRejectedValue(new Error('timeout'));
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'rul_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('timeout');
    });
  });

  describe('create', () => {
    it('creates and returns rule', async () => {
      const row = { id: 'rul_TEST', source_id: 'src_1', event_pattern: 'kpi.*', group_id: 'grp_1' };
      repo.create.mockResolvedValue(row);
      const res = makeRes();
      await create(makeReq({ body: { source_id: 'src_1', event_pattern: 'kpi.*', group_id: 'grp_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 400 when source_id missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: { event_pattern: 'kpi.*', group_id: 'grp_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('passes 400 when event_pattern missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: { source_id: 'src_1', group_id: 'grp_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('passes 400 when group_id missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: { source_id: 'src_1', event_pattern: 'kpi.*' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('propagates repo error', async () => {
      repo.create.mockRejectedValue(new Error('FK violation'));
      const next = vi.fn();
      await create(makeReq({ body: { source_id: 'src_1', event_pattern: 'kpi.*', group_id: 'grp_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('FK violation');
    });
  });

  describe('update', () => {
    it('returns updated rule', async () => {
      const row = { id: 'rul_1', active: false };
      repo.update.mockResolvedValue(row);
      const res = makeRes();
      await update(makeReq({ params: { id: 'rul_1' }, body: { active: false } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.update.mockResolvedValue(null);
      const next = vi.fn();
      await update(makeReq({ params: { id: 'rul_x' }, body: { active: false } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.update.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await update(makeReq({ params: { id: 'rul_1' }, body: {} }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('remove', () => {
    it('returns 204 on success', async () => {
      repo.findById.mockResolvedValue({ id: 'rul_1' });
      repo.remove.mockResolvedValue();
      const res = makeRes();
      await remove(makeReq({ params: { id: 'rul_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('passes 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'rul_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findById.mockResolvedValue({ id: 'rul_1' });
      repo.remove.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'rul_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });
});
