import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config.js', () => ({
  default: {
    jwtSecret: 'test-secret-32-bytes-long-xxxxxx',
    jwtTtlSeconds: 604800,
  },
}));

import { jwtAuth } from '../middleware/jwt.js';
import { signAdminToken } from '../util/jwt.js';
import { HttpError } from '../util/HttpError.js';

const SECRET = 'test-secret-32-bytes-long-xxxxxx';
const TTL = 604800;

function makeReq(headerValue) {
  return {
    headers: headerValue !== undefined ? { authorization: headerValue } : {},
  };
}

beforeEach(() => vi.clearAllMocks());

describe('jwtAuth middleware', () => {
  describe('happy path', () => {
    it('attaches req.admin and calls next() without error for a valid token', () => {
      const { token } = signAdminToken('admin', SECRET, TTL);
      const req = makeReq(`Bearer ${token}`);
      const next = vi.fn();

      jwtAuth(req, {}, next);

      expect(req.admin).toEqual({ username: 'admin' });
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('edge cases', () => {
    it('passes HttpError(401, missing_token) when Authorization header is absent', () => {
      const req = makeReq(undefined);
      const next = vi.fn();

      jwtAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('missing_token');
    });

    it('passes HttpError(401, missing_token) when header does not start with Bearer', () => {
      const req = makeReq('Token somevalue');
      const next = vi.fn();

      jwtAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('missing_token');
    });
  });

  describe('error path', () => {
    it('passes HttpError(401, invalid_token) for a malformed token', () => {
      const req = makeReq('Bearer not.a.real.jwt');
      const next = vi.fn();

      jwtAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid_token');
    });

    it('passes HttpError(401, invalid_token) for a token signed with wrong secret', () => {
      const { token } = signAdminToken('admin', 'wrong-secret-padding-xxxxxxxxxxxxx', TTL);
      const req = makeReq(`Bearer ${token}`);
      const next = vi.fn();

      jwtAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid_token');
    });
  });
});
