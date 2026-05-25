import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/proxyAccount.repo.js', () => ({
  getProxyAccount: vi.fn(),
  setProxyAccount: vi.fn(),
}));

vi.mock('../integrations/msal.service.js', () => ({
  getDelegatedToken: vi.fn(),
  getSignedInAccount: vi.fn(),
  signOut: vi.fn(),
  parseMsalAccount: vi.fn(),
  MSAL_CACHE_PATH: '/data/msal/.msal-cache.json',
}));

import { getStatus, startSignIn, signOutHandler } from '../controllers/admin/proxyAccount.controller.js';
import { getProxyAccount, setProxyAccount } from '../repositories/proxyAccount.repo.js';
import {
  getDelegatedToken,
  getSignedInAccount,
  signOut,
  parseMsalAccount,
} from '../integrations/msal.service.js';
import { HttpError } from '../util/HttpError.js';

function makeReq() {
  return {};
}

function makeRes() {
  const res = {};
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeSseRes() {
  const chunks = [];
  const res = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk) => chunks.push(chunk)),
    end: vi.fn(),
    _chunks: chunks,
  };
  return res;
}

function parseSseEvents(res) {
  return res._chunks.map((chunk) => {
    const eventLine = chunk.match(/event: (\w+)/)?.[1];
    const dataLine = chunk.match(/data: (.+)/)?.[1];
    return { event: eventLine, data: dataLine ? JSON.parse(dataLine) : null };
  });
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

describe('getStatus', () => {
  describe('happy path', () => {
    it('returns the proxy_account row from DB', async () => {
      const row = { id: 1, upn: 'proxy@example.com', status: 'signed_in' };
      getProxyAccount.mockResolvedValue(row);

      const res = makeRes();
      await getStatus(makeReq(), res, vi.fn());

      expect(res.json).toHaveBeenCalledWith(row);
    });
  });

  describe('edge case', () => {
    it('returns { status: "signed_out" } when no row exists', async () => {
      getProxyAccount.mockResolvedValue(null);

      const res = makeRes();
      await getStatus(makeReq(), res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ status: 'signed_out' });
    });
  });

  describe('error path', () => {
    it('calls next(err) when repo throws', async () => {
      const boom = new Error('db down');
      getProxyAccount.mockRejectedValue(boom);

      const next = vi.fn();
      await getStatus(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});

// ---------------------------------------------------------------------------
// startSignIn
// ---------------------------------------------------------------------------

describe('startSignIn', () => {
  describe('happy path', () => {
    it('sets SSE headers, emits device_code then signed_in, calls res.end()', async () => {
      const deviceCodePayload = {
        verificationUri: 'https://microsoft.com/devicelogin',
        userCode: 'ABCD1234',
        message: 'Go to https://microsoft.com/devicelogin and enter code ABCD1234',
      };

      getDelegatedToken.mockImplementation(async (cb) => {
        cb(deviceCodePayload);
        return 'fake-access-token';
      });

      const msalAccount = { username: 'proxy@example.com', localAccountId: 'oid-123', name: 'Proxy User' };
      getSignedInAccount.mockResolvedValue(msalAccount);
      parseMsalAccount.mockReturnValue({ upn: 'proxy@example.com', aadUserId: 'oid-123', displayName: 'Proxy User' });
      setProxyAccount.mockResolvedValue({ id: 1, upn: 'proxy@example.com', status: 'signed_in' });

      const res = makeSseRes();
      await startSignIn(makeReq(), res, vi.fn());

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalled();

      const events = parseSseEvents(res);
      expect(events[0].event).toBe('device_code');
      expect(events[0].data.verification_uri).toBe('https://microsoft.com/devicelogin');
      expect(events[0].data.user_code).toBe('ABCD1234');
      expect(events[1].event).toBe('signed_in');
      expect(events[1].data.upn).toBe('proxy@example.com');

      expect(res.end).toHaveBeenCalled();
    });

    it('calls setProxyAccount with correct shape after successful sign-in', async () => {
      getDelegatedToken.mockImplementation(async (cb) => {
        cb({ verificationUri: 'https://microsoft.com/devicelogin', userCode: 'XY56', message: 'msg' });
        return 'token';
      });

      const msalAccount = { username: 'a@b.com', localAccountId: 'oid-1', name: 'A' };
      getSignedInAccount.mockResolvedValue(msalAccount);
      parseMsalAccount.mockReturnValue({ upn: 'a@b.com', aadUserId: 'oid-1', displayName: 'A' });
      setProxyAccount.mockResolvedValue({});

      const res = makeSseRes();
      await startSignIn(makeReq(), res, vi.fn());

      expect(setProxyAccount).toHaveBeenCalledWith(
        expect.objectContaining({ upn: 'a@b.com', status: 'signed_in', cachePath: '/data/msal/.msal-cache.json' })
      );
    });
  });

  describe('edge case', () => {
    it('ends without signed_in event when getSignedInAccount returns null', async () => {
      getDelegatedToken.mockImplementation(async (cb) => {
        cb({ verificationUri: 'https://x.com', userCode: 'CODE', message: 'm' });
        return 'token';
      });

      getSignedInAccount.mockResolvedValue(null);

      const res = makeSseRes();
      await startSignIn(makeReq(), res, vi.fn());

      const events = parseSseEvents(res);
      const signedInEvents = events.filter((e) => e.event === 'signed_in');
      expect(signedInEvents).toHaveLength(0);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('error path', () => {
    it('emits error event and calls res.end() when getDelegatedToken throws', async () => {
      getDelegatedToken.mockRejectedValue(new Error('device code timeout'));

      const res = makeSseRes();
      await startSignIn(makeReq(), res, vi.fn());

      const events = parseSseEvents(res);
      expect(events[0].event).toBe('error');
      expect(events[0].data.message).toBe('device code timeout');
      expect(res.end).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// signOutHandler
// ---------------------------------------------------------------------------

describe('signOutHandler', () => {
  describe('happy path', () => {
    it('calls signOut() and returns { ok: true }', async () => {
      signOut.mockResolvedValue(undefined);

      const res = makeRes();
      await signOutHandler(makeReq(), res, vi.fn());

      expect(signOut).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('edge case', () => {
    it('still returns 200 if signOut resolves without errors', async () => {
      signOut.mockResolvedValue(undefined);

      const next = vi.fn();
      const res = makeRes();
      await signOutHandler(makeReq(), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('error path', () => {
    it('calls next(err) when signOut throws', async () => {
      const boom = new Error('cache write failed');
      signOut.mockRejectedValue(boom);

      const next = vi.fn();
      await signOutHandler(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
