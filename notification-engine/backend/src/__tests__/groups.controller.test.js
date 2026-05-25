import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/groups.repo.js', () => ({
  listGroups: vi.fn(),
  findGroupById: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  removeGroup: vi.fn(),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}));

import * as repo from '../repositories/groups.repo.js';
import { list, getOne, create, update, remove, addMember, removeMember } from '../controllers/admin/groups.controller.js';
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

describe('groups controller', () => {
  describe('list', () => {
    it('returns all groups', async () => {
      const rows = [{ id: 'grp_1' }];
      repo.listGroups.mockResolvedValue(rows);
      const res = makeRes();
      await list(makeReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('propagates error', async () => {
      repo.listGroups.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await list(makeReq(), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('getOne', () => {
    it('returns group with members', async () => {
      const group = { id: 'grp_1', name: 'Ops' };
      const members = [{ id: 'mbr_1' }];
      repo.findGroupById.mockResolvedValue(group);
      repo.listMembers.mockResolvedValue(members);
      const res = makeRes();
      await getOne(makeReq({ params: { id: 'grp_1' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith({ ...group, members });
    });

    it('passes 404 when not found', async () => {
      repo.findGroupById.mockResolvedValue(null);
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'grp_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findGroupById.mockRejectedValue(new Error('timeout'));
      const next = vi.fn();
      await getOne(makeReq({ params: { id: 'grp_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('timeout');
    });
  });

  describe('create', () => {
    it('creates and returns group', async () => {
      const row = { id: 'grp_TEST', name: 'Ops' };
      repo.createGroup.mockResolvedValue(row);
      const res = makeRes();
      await create(makeReq({ body: { name: 'Ops' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 400 when name missing', async () => {
      const next = vi.fn();
      await create(makeReq({ body: {} }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('propagates error', async () => {
      repo.createGroup.mockRejectedValue(new Error('unique violation'));
      const next = vi.fn();
      await create(makeReq({ body: { name: 'Dup' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('unique violation');
    });
  });

  describe('update', () => {
    it('returns updated group', async () => {
      const row = { id: 'grp_1', name: 'Updated' };
      repo.updateGroup.mockResolvedValue(row);
      const res = makeRes();
      await update(makeReq({ params: { id: 'grp_1' }, body: { name: 'Updated' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.updateGroup.mockResolvedValue(null);
      const next = vi.fn();
      await update(makeReq({ params: { id: 'grp_x' }, body: { name: 'X' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.updateGroup.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await update(makeReq({ params: { id: 'grp_1' }, body: {} }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('remove', () => {
    it('returns 204 on success', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      repo.removeGroup.mockResolvedValue();
      const res = makeRes();
      await remove(makeReq({ params: { id: 'grp_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('passes 404 when not found', async () => {
      repo.findGroupById.mockResolvedValue(null);
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'grp_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      repo.removeGroup.mockRejectedValue(new Error('FK constraint'));
      const next = vi.fn();
      await remove(makeReq({ params: { id: 'grp_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('FK constraint');
    });
  });

  describe('addMember', () => {
    it('adds member and returns it', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      const member = { id: 'mbr_TEST', group_id: 'grp_1', member_type: 'user', member_id: 'usr_1' };
      repo.addMember.mockResolvedValue(member);
      const res = makeRes();
      await addMember(makeReq({ params: { id: 'grp_1' }, body: { member_type: 'user', member_id: 'usr_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(member);
    });

    it('passes 404 when group not found', async () => {
      repo.findGroupById.mockResolvedValue(null);
      const next = vi.fn();
      await addMember(makeReq({ params: { id: 'grp_x' }, body: { member_type: 'user', member_id: 'usr_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('passes 400 when member_type is invalid', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      const next = vi.fn();
      await addMember(makeReq({ params: { id: 'grp_1' }, body: { member_type: 'team', member_id: 'usr_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
      expect(next.mock.calls[0][0].code).toBe('invalid_body');
    });

    it('passes 400 when member_id missing', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      const next = vi.fn();
      await addMember(makeReq({ params: { id: 'grp_1' }, body: { member_type: 'user' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });
  });

  describe('removeMember', () => {
    it('returns 204 on success', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      repo.removeMember.mockResolvedValue();
      const res = makeRes();
      await removeMember(makeReq({ params: { id: 'grp_1', memberType: 'user', memberId: 'usr_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('passes 404 when group not found', async () => {
      repo.findGroupById.mockResolvedValue(null);
      const next = vi.fn();
      await removeMember(makeReq({ params: { id: 'grp_x', memberType: 'user', memberId: 'usr_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('passes 400 when memberType is invalid', async () => {
      repo.findGroupById.mockResolvedValue({ id: 'grp_1' });
      const next = vi.fn();
      await removeMember(makeReq({ params: { id: 'grp_1', memberType: 'bot', memberId: 'usr_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });
  });
});
