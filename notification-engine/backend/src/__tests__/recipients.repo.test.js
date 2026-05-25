import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../util/ulid.js', () => ({
  generateId: vi.fn((prefix) => `${prefix}TEST`),
}));

import { pool } from '../db/pool.js';
import {
  findUserById,
  findUserByUpn,
  listUsers,
  createUser,
  updateUser,
  removeUser,
  findChannelById,
  listChannels,
  createChannel,
  updateChannel,
  removeChannel,
} from '../repositories/recipients.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('recipients.repo — users', () => {
  describe('findUserById', () => {
    it('returns row when found', async () => {
      const row = { id: 'usr_1', display_name: 'Alice', upn: 'alice@example.com' };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await findUserById('usr_1');
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['usr_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findUserById('usr_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findUserById('usr_1')).rejects.toThrow('DB error');
    });
  });

  describe('findUserByUpn', () => {
    it('returns row when found', async () => {
      const row = { id: 'usr_1', upn: 'alice@example.com' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findUserByUpn('alice@example.com')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['alice@example.com']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findUserByUpn('nobody@example.com')).toBeNull();
    });
  });

  describe('listUsers', () => {
    it('returns all rows', async () => {
      const rows = [{ id: 'usr_1' }, { id: 'usr_2' }];
      pool.query.mockResolvedValue({ rows });
      expect(await listUsers()).toEqual(rows);
    });
  });

  describe('createUser', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'usr_TEST', display_name: 'Bob', upn: 'bob@example.com', aad_user_id: null, notes: null };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await createUser({ displayName: 'Bob', upn: 'bob@example.com' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['usr_TEST', 'Bob', 'bob@example.com', null, null]
      );
    });

    it('passes aadUserId and notes when provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      await createUser({ displayName: 'Bob', upn: 'bob@example.com', aadUserId: 'aad-1', notes: 'note' });
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['usr_TEST', 'Bob', 'bob@example.com', 'aad-1', 'note']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('unique violation'));
      await expect(createUser({ displayName: 'Bob', upn: 'bob@example.com' })).rejects.toThrow('unique violation');
    });
  });

  describe('updateUser', () => {
    it('returns updated row', async () => {
      const row = { id: 'usr_1', display_name: 'Updated' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await updateUser('usr_1', { displayName: 'Updated' })).toEqual(row);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await updateUser('usr_missing', { displayName: 'X' })).toBeNull();
    });
  });

  describe('removeUser', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(removeUser('usr_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['usr_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(removeUser('usr_1')).rejects.toThrow('DB error');
    });
  });
});

describe('recipients.repo — channels', () => {
  describe('findChannelById', () => {
    it('returns row when found', async () => {
      const row = { id: 'chn_1', display_name: 'General' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await findChannelById('chn_1')).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['chn_1']);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await findChannelById('chn_missing')).toBeNull();
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(findChannelById('chn_1')).rejects.toThrow('DB error');
    });
  });

  describe('listChannels', () => {
    it('returns all rows', async () => {
      const rows = [{ id: 'chn_1' }];
      pool.query.mockResolvedValue({ rows });
      expect(await listChannels()).toEqual(rows);
    });
  });

  describe('createChannel', () => {
    it('inserts and returns new row with generated id', async () => {
      const row = { id: 'chn_TEST', display_name: 'Alerts', team_id: 't1', channel_id: 'c1', notes: null };
      pool.query.mockResolvedValue({ rows: [row] });
      const result = await createChannel({ displayName: 'Alerts', teamId: 't1', channelId: 'c1' });
      expect(result).toEqual(row);
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['chn_TEST', 'Alerts', 't1', 'c1', null]
      );
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('unique violation'));
      await expect(createChannel({ displayName: 'A', teamId: 't', channelId: 'c' })).rejects.toThrow('unique violation');
    });
  });

  describe('updateChannel', () => {
    it('returns updated row', async () => {
      const row = { id: 'chn_1', display_name: 'Updated' };
      pool.query.mockResolvedValue({ rows: [row] });
      expect(await updateChannel('chn_1', { displayName: 'Updated' })).toEqual(row);
    });

    it('returns null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      expect(await updateChannel('chn_missing', { displayName: 'X' })).toBeNull();
    });
  });

  describe('removeChannel', () => {
    it('executes DELETE without error', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await expect(removeChannel('chn_1')).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['chn_1']);
    });

    it('propagates DB error', async () => {
      pool.query.mockRejectedValue(new Error('DB error'));
      await expect(removeChannel('chn_1')).rejects.toThrow('DB error');
    });
  });
});
