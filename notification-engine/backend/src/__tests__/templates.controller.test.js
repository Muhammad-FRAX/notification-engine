import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/templates.repo.js', () => ({
  listTemplates: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../services/template.service.js', () => ({
  renderTemplate: vi.fn(),
}));

import * as repo from '../repositories/templates.repo.js';
import { renderTemplate } from '../services/template.service.js';
import { list, getOne, create, update, remove, preview } from '../controllers/admin/templates.controller.js';
import { HttpError } from '../util/HttpError.js';

function makeReq(opts = {}) {
  return { body: opts.body ?? {}, params: opts.params ?? {} };
}

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('templates controller', () => {
  describe('list', () => {
    it('returns all templates', async () => {
      const rows = [{ id: 'tpl_1' }];
      repo.listTemplates.mockResolvedValue(rows);
      const res = makeRes();
      await list(makeReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('propagates error', async () => {
      repo.listTemplates.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await list(makeReq(), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('getOne', () => {
    it('returns template when found', async () => {
      const row = { id: 'tpl_1', name: 'Alert' };
      repo.findById.mockResolvedValue(row);
      const res = makeRes();
      await getOne(makeReq({ params: { id: 'tpl_1' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'tpl_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findById.mockRejectedValue(new Error('timeout'));
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'tpl_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('timeout');
    });
  });

  describe('create', () => {
    it('creates and returns template', async () => {
      const row = { id: 'tpl_TEST', name: 'Alert', kind: 'text_html', body: '<p>{{title}}</p>' };
      repo.create.mockResolvedValue(row);
      const res = makeRes();
      await create(makeReq({ body: { name: 'Alert', kind: 'text_html', body: '<p>{{title}}</p>' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 400 when name missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: { kind: 'text_html', body: '<p></p>' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('passes 400 when kind is invalid', async () => {
      const next = vi.fn();
      await create(makeReq({ body: { name: 'X', kind: 'invalid', body: '<p></p>' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
      expect(next.mock.calls[0][0].code).toBe('invalid_body');
    });

    it('passes 400 when body missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: { name: 'X', kind: 'text_html' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('propagates repo error', async () => {
      repo.create.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await create(makeReq({ body: { name: 'Alert', kind: 'text_html', body: '<p></p>' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('update', () => {
    it('returns updated template', async () => {
      const row = { id: 'tpl_1', name: 'Updated' };
      repo.update.mockResolvedValue(row);
      const res = makeRes();
      await update(makeReq({ params: { id: 'tpl_1' }, body: { name: 'Updated' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.update.mockResolvedValue(null);
      const next = vi.fn();
      await update(makeReq({ params: { id: 'tpl_x' }, body: { active: false } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('passes 400 for invalid kind', async () => {
      const next = vi.fn();
      await update(makeReq({ params: { id: 'tpl_1' }, body: { kind: 'invalid' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('propagates error', async () => {
      repo.update.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await update(makeReq({ params: { id: 'tpl_1' }, body: {} }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('remove', () => {
    it('returns 204 on success', async () => {
      repo.findById.mockResolvedValue({ id: 'tpl_1' });
      repo.remove.mockResolvedValue();
      const res = makeRes();
      await remove(makeReq({ params: { id: 'tpl_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('passes 404 when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'tpl_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findById.mockResolvedValue({ id: 'tpl_1' });
      repo.remove.mockRejectedValue(new Error('FK violation'));
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'tpl_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('FK violation');
    });
  });

  describe('preview', () => {
    const tpl = { id: 'tpl_1', name: 'Alert', kind: 'text_html', body: '<p>{{title}}</p>', vars_schema: null };

    it('returns rendered output', async () => {
      repo.findById.mockResolvedValue(tpl);
      const rendered = { htmlBody: '<p>Outage</p>', attachments: [], hostedContents: [] };
      renderTemplate.mockReturnValue(rendered);
      const res = makeRes();
      await preview(makeReq({ params: { id: 'tpl_1' }, body: { vars: { title: 'Outage' } } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rendered);
    });

    it('passes 404 when template not found', async () => {
      repo.findById.mockResolvedValue(null);
      const next = vi.fn();
      await preview(makeReq({ params: { id: 'tpl_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('passes 422 on template_validation error', async () => {
      repo.findById.mockResolvedValue(tpl);
      const err = new Error('Required field missing: title');
      err.code = 'template_validation';
      renderTemplate.mockImplementation(() => { throw err; });
      const next = vi.fn();
      await preview(makeReq({ params: { id: 'tpl_1' }, body: { vars: {} } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(422);
      expect(next.mock.calls[0][0].code).toBe('template_validation');
    });

    it('propagates unexpected render error', async () => {
      repo.findById.mockResolvedValue(tpl);
      renderTemplate.mockImplementation(() => { throw new Error('unexpected'); });
      const next = vi.fn();
      await preview(makeReq({ params: { id: 'tpl_1' }, body: { vars: {} } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('unexpected');
    });
  });
});
