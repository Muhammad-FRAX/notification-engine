import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/recipients.repo.js', () => ({
  listUsers: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  removeUser: vi.fn(),
  listChannels: vi.fn(),
  findChannelById: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  removeChannel: vi.fn(),
}));

import * as repo from '../repositories/recipients.repo.js';
import {
  listUsers, getUser, createUser, updateUser, removeUser,
  listChannels, getChannel, createChannel, updateChannel, removeChannel,
} from '../controllers/admin/recipients.controller.js';
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

describe('recipients controller — users', () => {
  describe('listUsers', () => {
    it('returns user list', async () => {
      const rows = [{ id: 'usr_1' }];
      repo.listUsers.mockResolvedValue(rows);
      const res = makeRes();
      await listUsers(makeReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('propagates error', async () => {
      repo.listUsers.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await listUsers(makeReq(), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('getUser', () => {
    it('returns user when found', async () => {
      const row = { id: 'usr_1', display_name: 'Alice' };
      repo.findUserById.mockResolvedValue(row);
      const res = makeRes();
      await getUser(makeReq({ params: { id: 'usr_1' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.findUserById.mockResolvedValue(null);
      const next = vi.fn();
      await getUser(makeReq({ params: { id: 'usr_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findUserById.mockRejectedValue(new Error('timeout'));
      const next = vi.fn();
      await getUser(makeReq({ params: { id: 'usr_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('timeout');
    });
  });

  describe('createUser', () => {
    it('creates and returns user', async () => {
      const row = { id: 'usr_TEST', display_name: 'Alice', upn: 'alice@example.com' };
      repo.createUser.mockResolvedValue(row);
      const res = makeRes();
      await createUser(makeReq({ body: { display_name: 'Alice', upn: 'alice@example.com' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 400 when display_name missing', async () => {
      const next = vi.fn();
      await createUser(makeReq({ body: { upn: 'alice@example.com' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
      expect(next.mock.calls[0][0].code).toBe('invalid_body');
    });

    it('passes 400 when upn missing', async () => {
      const next = vi.fn();
      await createUser(makeReq({ body: { display_name: 'Alice' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('propagates repo error', async () => {
      repo.createUser.mockRejectedValue(new Error('unique violation'));
      const next = vi.fn();
      await createUser(makeReq({ body: { display_name: 'Alice', upn: 'alice@example.com' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('unique violation');
    });
  });

  describe('removeUser', () => {
    it('returns 204 on success', async () => {
      repo.findUserById.mockResolvedValue({ id: 'usr_1' });
      repo.removeUser.mockResolvedValue();
      const res = makeRes();
      await removeUser(makeReq({ params: { id: 'usr_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('passes 404 when not found', async () => {
      repo.findUserById.mockResolvedValue(null);
      const next = vi.fn();
      await removeUser(makeReq({ params: { id: 'usr_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findUserById.mockResolvedValue({ id: 'usr_1' });
      repo.removeUser.mockRejectedValue(new Error('FK violation'));
      const next = vi.fn();
      await removeUser(makeReq({ params: { id: 'usr_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('FK violation');
    });
  });
});

describe('recipients controller — channels', () => {
  describe('listChannels', () => {
    it('returns channel list', async () => {
      const rows = [{ id: 'chn_1' }];
      repo.listChannels.mockResolvedValue(rows);
      const res = makeRes();
      await listChannels(makeReq(), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('propagates error', async () => {
      repo.listChannels.mockRejectedValue(new Error('DB error'));
      const next = vi.fn();
      await listChannels(makeReq(), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('DB error');
    });
  });

  describe('getChannel', () => {
    it('returns channel when found', async () => {
      const row = { id: 'chn_1', display_name: 'Ops' };
      repo.findChannelById.mockResolvedValue(row);
      const res = makeRes();
      await getChannel(makeReq({ params: { id: 'chn_1' } }), res, vi.fn());
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 404 when not found', async () => {
      repo.findChannelById.mockResolvedValue(null);
      const next = vi.fn();
      await getChannel(makeReq({ params: { id: 'chn_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findChannelById.mockRejectedValue(new Error('timeout'));
      const next = vi.fn();
      await getChannel(makeReq({ params: { id: 'chn_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('timeout');
    });
  });

  describe('createChannel', () => {
    it('creates and returns channel', async () => {
      const row = { id: 'chn_TEST', display_name: 'Ops', team_id: 't1', channel_id: 'c1' };
      repo.createChannel.mockResolvedValue(row);
      const res = makeRes();
      await createChannel(makeReq({ body: { display_name: 'Ops', team_id: 't1', channel_id: 'c1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(row);
    });

    it('passes 400 when display_name missing', async () => {
      const next = vi.fn();
      await createChannel(makeReq({ body: { team_id: 't1', channel_id: 'c1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('passes 400 when team_id missing', async () => {
      const next = vi.fn();
      await createChannel(makeReq({ body: { display_name: 'Ops', channel_id: 'c1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('passes 400 when channel_id missing', async () => {
      const next = vi.fn();
      await createChannel(makeReq({ body: { display_name: 'Ops', team_id: 't1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    it('propagates repo error', async () => {
      repo.createChannel.mockRejectedValue(new Error('unique violation'));
      const next = vi.fn();
      await createChannel(makeReq({ body: { display_name: 'Ops', team_id: 't1', channel_id: 'c1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('unique violation');
    });
  });

  describe('removeChannel', () => {
    it('returns 204 on success', async () => {
      repo.findChannelById.mockResolvedValue({ id: 'chn_1' });
      repo.removeChannel.mockResolvedValue();
      const res = makeRes();
      await removeChannel(makeReq({ params: { id: 'chn_1' } }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('passes 404 when not found', async () => {
      repo.findChannelById.mockResolvedValue(null);
      const next = vi.fn();
      await removeChannel(makeReq({ params: { id: 'chn_x' } }), makeRes(), next);
      expect(next.mock.calls[0][0].status).toBe(404);
    });

    it('propagates error', async () => {
      repo.findChannelById.mockResolvedValue({ id: 'chn_1' });
      repo.removeChannel.mockRejectedValue(new Error('FK violation'));
      const next = vi.fn();
      await removeChannel(makeReq({ params: { id: 'chn_1' } }), makeRes(), next);
      expect(next.mock.calls[0][0].message).toBe('FK violation');
    });
  });
});
