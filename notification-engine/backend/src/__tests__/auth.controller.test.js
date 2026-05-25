import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  default: {
    adminUsername: 'admin',
    adminPassword: 'admin123',
    jwtSecret: 'test-secret-32-bytes-long-xxxxxx',
    jwtTtlSeconds: 604800,
  },
}));

import { login, me } from '../controllers/admin/auth.controller.js';
import { HttpError } from '../util/HttpError.js';

function makeReq(body) {
  return { body };
}

function makeRes() {
  const res = {};
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('login controller', () => {
  describe('happy path', () => {
    it('returns { token, expires_at } for valid credentials', async () => {
      const req = makeReq({ username: 'admin', password: 'admin123' });
      const res = makeRes();
      const next = vi.fn();

      await login(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledOnce();
      const result = res.json.mock.calls[0][0];
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.').length).toBe(3);
      expect(result.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('edge cases', () => {
    it('passes HttpError(400) when body is missing', async () => {
      const req = makeReq(undefined);
      const next = vi.fn();

      await login(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(400);
      expect(err.code).toBe('invalid_body');
    });

    it('passes HttpError(400) when password is not a string', async () => {
      const req = makeReq({ username: 'admin', password: 123 });
      const next = vi.fn();

      await login(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(400);
    });
  });

  describe('error path', () => {
    it('passes HttpError(401) for wrong password', async () => {
      const req = makeReq({ username: 'admin', password: 'wrongpassword' });
      const next = vi.fn();

      await login(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid_credentials');
    });

    it('passes HttpError(401) for wrong username', async () => {
      const req = makeReq({ username: 'hacker', password: 'admin123' });
      const next = vi.fn();

      await login(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid_credentials');
    });
  });
});

describe('me controller', () => {
  describe('happy path', () => {
    it('returns { username } from req.admin', async () => {
      const req = { admin: { username: 'admin' } };
      const res = makeRes();

      await me(req, res);

      expect(res.json).toHaveBeenCalledWith({ username: 'admin' });
    });
  });
});
