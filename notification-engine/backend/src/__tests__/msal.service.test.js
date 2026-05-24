import { describe, it, expect } from 'vitest';
import { buildMsalConfig, parseMsalAccount } from '../util/msalUtils.js';

describe('buildMsalConfig', () => {
  it('builds a valid MSAL config object (happy path)', () => {
    const cfg = buildMsalConfig('client-abc', 'tenant-xyz');
    expect(cfg).toEqual({
      auth: {
        clientId: 'client-abc',
        authority: 'https://login.microsoftonline.com/tenant-xyz',
      },
    });
  });

  it('uses the provided clientId and tenantId verbatim', () => {
    const cfg = buildMsalConfig('test-client', 'test-tenant');
    expect(cfg.auth.clientId).toBe('test-client');
    expect(cfg.auth.authority).toContain('test-tenant');
  });

  it('throws when clientId is empty (error path)', () => {
    expect(() => buildMsalConfig('', 'tenant-xyz')).toThrow();
  });
});

describe('parseMsalAccount', () => {
  const sampleAccount = {
    homeAccountId: 'oid123.tid456',
    localAccountId: 'oid123',
    username: 'user@example.com',
    name: 'Test User',
    tenantId: 'tid456',
    environment: 'login.windows.net',
  };

  it('extracts upn, aadUserId, and displayName (happy path)', () => {
    const result = parseMsalAccount(sampleAccount);
    expect(result.upn).toBe('user@example.com');
    expect(result.aadUserId).toBe('oid123');
    expect(result.displayName).toBe('Test User');
  });

  it('falls back to username when name is absent (edge case)', () => {
    const result = parseMsalAccount({ ...sampleAccount, name: undefined });
    expect(result.displayName).toBe('user@example.com');
  });

  it('throws when account is null (error path)', () => {
    expect(() => parseMsalAccount(null)).toThrow();
  });
});
