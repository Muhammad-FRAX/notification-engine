import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/groups.repo.js', () => ({
  listMembers: vi.fn(),
}));

vi.mock('../repositories/recipients.repo.js', () => ({
  findUserById: vi.fn(),
  findChannelById: vi.fn(),
}));

import { listMembers } from '../repositories/groups.repo.js';
import { findUserById, findChannelById } from '../repositories/recipients.repo.js';
import { expandGroup } from '../services/audience.service.js';

beforeEach(() => vi.clearAllMocks());

describe('expandGroup', () => {
  describe('happy path', () => {
    it('returns an empty array when the group has no members', async () => {
      listMembers.mockResolvedValue([]);
      const result = await expandGroup('grp_1');
      expect(result).toEqual([]);
    });

    it('resolves user members', async () => {
      const userRow = { id: 'usr_1', display_name: 'Alice', upn: 'alice@example.com' };
      listMembers.mockResolvedValue([
        { id: 'mbr_1', group_id: 'grp_1', member_type: 'user', member_id: 'usr_1' },
      ]);
      findUserById.mockResolvedValue(userRow);
      const result = await expandGroup('grp_1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'user', id: 'usr_1', details: userRow });
    });

    it('resolves channel members', async () => {
      const channelRow = { id: 'chn_1', display_name: 'Ops', team_id: 't1', channel_id: 'c1' };
      listMembers.mockResolvedValue([
        { id: 'mbr_2', group_id: 'grp_1', member_type: 'channel', member_id: 'chn_1' },
      ]);
      findChannelById.mockResolvedValue(channelRow);
      const result = await expandGroup('grp_1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'channel', id: 'chn_1', details: channelRow });
    });

    it('resolves mixed user and channel members', async () => {
      const userRow = { id: 'usr_1', upn: 'a@b.com' };
      const channelRow = { id: 'chn_1', team_id: 't1', channel_id: 'c1' };
      listMembers.mockResolvedValue([
        { member_type: 'user', member_id: 'usr_1' },
        { member_type: 'channel', member_id: 'chn_1' },
      ]);
      findUserById.mockResolvedValue(userRow);
      findChannelById.mockResolvedValue(channelRow);
      const result = await expandGroup('grp_1');
      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('silently skips a user member whose row no longer exists', async () => {
      listMembers.mockResolvedValue([
        { member_type: 'user', member_id: 'usr_gone' },
      ]);
      findUserById.mockResolvedValue(null);
      const result = await expandGroup('grp_1');
      expect(result).toHaveLength(0);
    });

    it('silently skips a channel member whose row no longer exists', async () => {
      listMembers.mockResolvedValue([
        { member_type: 'channel', member_id: 'chn_gone' },
      ]);
      findChannelById.mockResolvedValue(null);
      const result = await expandGroup('grp_1');
      expect(result).toHaveLength(0);
    });

    it('skips members with an unknown member_type', async () => {
      listMembers.mockResolvedValue([
        { member_type: 'unknown', member_id: 'x' },
      ]);
      const result = await expandGroup('grp_1');
      expect(result).toHaveLength(0);
      expect(findUserById).not.toHaveBeenCalled();
      expect(findChannelById).not.toHaveBeenCalled();
    });
  });

  describe('error path', () => {
    it('propagates listMembers errors', async () => {
      listMembers.mockRejectedValue(new Error('DB down'));
      await expect(expandGroup('grp_1')).rejects.toThrow('DB down');
    });

    it('propagates findUserById errors', async () => {
      listMembers.mockResolvedValue([{ member_type: 'user', member_id: 'usr_1' }]);
      findUserById.mockRejectedValue(new Error('timeout'));
      await expect(expandGroup('grp_1')).rejects.toThrow('timeout');
    });
  });
});
