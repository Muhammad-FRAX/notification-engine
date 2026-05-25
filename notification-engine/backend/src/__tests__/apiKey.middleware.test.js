import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/sources.repo.js', () => ({
  findAll: vi.fn(),
  touchLastUsed: vi.fn(),
}));

vi.mock('../util/hash.js', () => ({
  verifyApiKey: vi.fn(),
}));

import { findAll, touchLastUsed } from '../repositories/sources.repo.js';
import { verifyApiKey } from '../util/hash.js';
import { apiKeyAuth, isRateLimited } from '../middleware/apiKey.js';
import { HttpError } from '../util/HttpError.js';

const SOURCE = {
  id: 'src_1',
  name: 'Test Source',
  api_key_prefix: 'abc12345',
  api_key_hash: '$argon2id$...',
  rate_limit_rpm: 60,
  active: true,
};

const makeReq = (key) => ({
  headers: key !== undefined ? { 'x-api-key': key } : {},
});

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// apiKeyAuth middleware
// ---------------------------------------------------------------------------

describe('apiKeyAuth', () => {
  describe('happy path', () => {
    it('attaches req.source and calls next() without error when key is valid', async () => {
      findAll.mockResolvedValue([SOURCE]);
      verifyApiKey.mockResolvedValue(true);

      const req = makeReq('abc12345validkeyrest');
      const next = vi.fn();

      await apiKeyAuth(req, {}, next);

      expect(req.source).toBe(SOURCE);
      expect(touchLastUsed).toHaveBeenCalledWith('src_1');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('edge cases', () => {
    it('passes HttpError(401, missing_api_key) to next when header is absent', async () => {
      const req = makeReq(undefined);
      const next = vi.fn();

      await apiKeyAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('missing_api_key');
    });

    it('passes HttpError(401) when prefix matches no active source', async () => {
      findAll.mockResolvedValue([]);
      const req = makeReq('xxxxxxxx_unknownkey');
      const next = vi.fn();

      await apiKeyAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid_api_key');
    });

    it('passes HttpError(429) when source exceeds rate limit', async () => {
      // Use a unique ID so this test is isolated from the shared in-memory window
      const limitedSource = {
        ...SOURCE,
        id: `src_rl_mw_${Date.now()}`,
        api_key_prefix: 'rl000001',
        rate_limit_rpm: 1,
      };
      findAll.mockResolvedValue([limitedSource]);
      verifyApiKey.mockResolvedValue(true);
      touchLastUsed.mockResolvedValue();

      // First request primes the window (count=1, allowed since 1 is not > 1)
      await apiKeyAuth(makeReq('rl000001keyvalue1'), {}, vi.fn());

      // Second request increments count to 2; 2 > 1 is rate-limited
      const next = vi.fn();
      await apiKeyAuth(makeReq('rl000001keyvalue1'), {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(429);
      expect(err.code).toBe('rate_limited');
    });
  });

  describe('error path', () => {
    it('passes HttpError(401, invalid_api_key) when hash verification fails', async () => {
      findAll.mockResolvedValue([SOURCE]);
      verifyApiKey.mockResolvedValue(false);

      const req = makeReq('abc12345wrongkey!!!');
      const next = vi.fn();

      await apiKeyAuth(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(HttpError);
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid_api_key');
    });

    it('forwards unexpected errors to next', async () => {
      findAll.mockRejectedValue(new Error('DB connection lost'));
      const req = makeReq('abc12345somekey1234');
      const next = vi.fn();

      await apiKeyAuth(req, {}, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('DB connection lost');
    });
  });
});

// ---------------------------------------------------------------------------
// isRateLimited — pure in-memory logic
// ---------------------------------------------------------------------------

describe('isRateLimited', () => {
  it('returns false on the first request', () => {
    const id = `src_rl_first_${Date.now()}`;
    expect(isRateLimited(id, 60)).toBe(false);
  });

  it('returns false on the 60th request when limit is 60', () => {
    const id = `src_rl_at_limit_${Date.now()}`;
    // 59 warmup calls bring count to 59
    for (let i = 0; i < 59; i++) isRateLimited(id, 60);
    // 60th call: count becomes 60; 60 > 60 is false — still allowed
    expect(isRateLimited(id, 60)).toBe(false);
  });

  it('returns true on the 61st request when limit is 60', () => {
    const id = `src_rl_over_limit_${Date.now()}`;
    // 60 warmup calls bring count to 60
    for (let i = 0; i < 60; i++) isRateLimited(id, 60);
    // 61st call: count becomes 61; 61 > 60 is true — rate limited
    expect(isRateLimited(id, 60)).toBe(true);
  });
});
