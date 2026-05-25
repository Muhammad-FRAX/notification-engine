import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../util/ulid.js', () => ({
  generateId: vi.fn((prefix) => `${prefix}TEST`),
}));

import { pool } from '../db/pool.js';
import {
  findGroupById,
  listGroups,
  createGroup,
  updateGroup,
  removeGroup,
  listMembers,
  addMember,
  removeMember,
} from '../repositories/groups.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('groups.repo — groups', () => {
  describe('findGroupById', () => {
    it('returns row when found', async () => {
      const row = { id: 'grp_1', name: 'Ops' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findGroupById('grp_1')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['grp_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findGroupById('grp_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findGroupById('grp_1')).rejects.toThrow('DB error');
    });
  });

  describe('listGroups', () => {
    it('returns all rows', async () => {
      const rows = [{ id: 'grp_1' }, { id: 'grp_2' }];
      pool.query.mockResolvedValue({ rows });
      expect(await listGroups()).toEqual(rows);
    });
  });

  describe('createGroup', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'grp_TEST', name: 'Ops', description: null };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await createGroup({ name: 'Ops' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['grp_TEST', 'Ops', null]
      );
    });

    it('passes description when provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await createGroup({ name: 'Ops', description: 'Ops team' });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['grp_TEST', 'Ops', 'Ops team']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('unique violation'));
      await expect(createGroup({ name: 'Ops' })).rejects.toThrow('unique violation');
    });
  });

  describe('updateGroup', () => {
    it('returns updated row', async () => {
      const row = { id: 'grp_1', name: 'Updated' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await updateGroup('grp_1', { name: 'Updated' })).toEqual(row);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await updateGroup('grp_missing', { name: 'X' })).toBeNull();
    });
  });

  describe('removeGroup', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(removeGroup('grp_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['grp_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('FK violation'));
      await expect(removeGroup('grp_1')).rejects.toThrow('FK violation');
    });
  });
});

describe('groups.repo — members', () => {
  describe('listMembers', () => {
    it('returns rows for the group', async () => {
      const rows = [{ id: 'mbr_1', group_id: 'grp_1' }];
      pool.query.mockResolvedValue({ rows });
      expect(await listMembers('grp_1')).toEqual(rows);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['grp_1']);
    });
  });

  describe('addMember', () => {
    it('returns new row on insert', async () => {
      const row = { id: 'mbr_TEST', group_id: 'grp_1', member_type: 'user', member_id: 'usr_1' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await addMember({ groupId: 'grp_1', memberType: 'user', memberId: 'usr_1' });
      expect(result).toEqual(row);
    });

    it('fetches existing row on conflict', async () => {
      const existing = { id: 'mbr_existing', group_id: 'grp_1', member_type: 'user', member_id: 'usr_1' };
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [existing] });
      const result = await addMember({ groupId: 'grp_1', memberType: 'user', memberId: 'usr_1' });
      expect(result).toEqual(existing);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(addMember({ groupId: 'grp_1', memberType: 'user', memberId: 'usr_1' })).rejects.toThrow('DB error');
    });
  });

  describe('removeMember', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(removeMember('grp_1', 'user', 'usr_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['grp_1', 'user', 'usr_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(removeMember('grp_1', 'user', 'usr_1')).rejects.toThrow('DB error');
    });
  });
});
