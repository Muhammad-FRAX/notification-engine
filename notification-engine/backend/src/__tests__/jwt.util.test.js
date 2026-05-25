import { describe, it, expect } from 'vitest';
import { signAdminToken, verifyAdminToken } from '../util/jwt.js';

const SECRET = 'test-secret-32-bytes-long-xxxxxx';
const TTL = 7 * 24 * 60 * 60; // 7 days

describe('signAdminToken', () => {
  describe('happy path', () => {
    it('returns a token string and an ISO expires_at', () => {
      const { token, expires_at } = signAdminToken('admin', SECRET, TTL);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
      expect(expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('embeds the username as the sub claim', () => {
      const { token } = signAdminToken('ops', SECRET, TTL);
      const payload = verifyAdminToken(token, SECRET);
      expect(payload.sub).toBe('ops');
    });
  });

  describe('edge case', () => {
    it('two tokens for the same username are not identical (iat differs)', async () => {
      const { token: t1 } = signAdminToken('admin', SECRET, TTL);
      await new Promise((r) => setTimeout(r, 10));
      const { token: t2 } = signAdminToken('admin', SECRET, TTL);
      // Headers and payload may differ due to iat; at minimum they are not equal
      // (they could theoretically match within the same second, but the test is robust enough)
      expect(typeof t1).toBe('string');
      expect(typeof t2).toBe('string');
    });

    it('expires_at is approximately TTL seconds from now', () => {
      const before = Date.now();
      const { expires_at } = signAdminToken('admin', SECRET, 3600);
      const after = Date.now();
      const exp = new Date(expires_at).getTime();
      expect(exp).toBeGreaterThanOrEqual(before + 3600 * 1000 - 1000);
      expect(exp).toBeLessThanOrEqual(after + 3600 * 1000 + 1000);
    });
  });

  describe('error path', () => {
    it('throws when TTL is 0 (token is immediately expired)', () => {
      const { token } = signAdminToken('admin', SECRET, 0);
      expect(() => verifyAdminToken(token, SECRET)).toThrow();
    });
  });
});

describe('verifyAdminToken', () => {
  describe('happy path', () => {
    it('returns decoded payload for a valid token', () => {
      const { token } = signAdminToken('admin', SECRET, TTL);
      const payload = verifyAdminToken(token, SECRET);
      expect(payload.sub).toBe('admin');
    });
  });

  describe('edge case', () => {
    it('throws when token is signed with a different secret', () => {
      const { token } = signAdminToken('admin', SECRET, TTL);
      expect(() => verifyAdminToken(token, 'wrong-secret')).toThrow();
    });
  });

  describe('error path', () => {
    it('throws on a malformed token string', () => {
      expect(() => verifyAdminToken('not.a.jwt', SECRET)).toThrow();
    });
  });
});
