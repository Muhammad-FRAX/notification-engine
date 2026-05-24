import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildConfig } from '../config.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildConfig', () => {
  describe('defaults (happy path)', () => {
    it('uses built-in defaults when env is empty', () => {
      const cfg = buildConfig({});
      expect(cfg.port).toBe(5000);
      expect(cfg.nodeEnv).toBe('development');
      expect(cfg.adminUsername).toBe('admin');
      expect(cfg.adminPassword).toBe('admin123');
      expect(cfg.defaultSourceRpm).toBe(60);
      expect(cfg.retryMaxAttempts).toBe(5);
      expect(cfg.retryBaseDelayMs).toBe(30000);
      expect(cfg.msalCacheDir).toBe('/data/msal');
    });

    it('reads values from the provided env map', () => {
      const cfg = buildConfig({
        PORT: '8080',
        NODE_ENV: 'production',
        ADMIN_USERNAME: 'ops',
        ADMIN_PASSWORD: 'hunter2',
        JWT_SECRET: 'static-secret',
        DEFAULT_SOURCE_RPM: '120',
        RETRY_MAX_ATTEMPTS: '3',
        RETRY_BASE_DELAY_MS: '10000',
        MSAL_CACHE_DIR: '/mnt/msal',
      });
      expect(cfg.port).toBe(8080);
      expect(cfg.nodeEnv).toBe('production');
      expect(cfg.adminUsername).toBe('ops');
      expect(cfg.adminPassword).toBe('hunter2');
      expect(cfg.jwtSecret).toBe('static-secret');
      expect(cfg.defaultSourceRpm).toBe(120);
      expect(cfg.retryMaxAttempts).toBe(3);
      expect(cfg.retryBaseDelayMs).toBe(10000);
      expect(cfg.msalCacheDir).toBe('/mnt/msal');
    });

    it('returns a frozen object', () => {
      const cfg = buildConfig({ JWT_SECRET: 'x' });
      expect(() => { cfg.port = 9999; }).toThrow();
    });
  });

  describe('JWT_SECRET auto-generation (edge case)', () => {
    it('generates a non-empty secret when JWT_SECRET is absent', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cfg = buildConfig({});
      expect(typeof cfg.jwtSecret).toBe('string');
      expect(cfg.jwtSecret.length).toBeGreaterThan(0);
    });

    it('generates different secrets on each call when JWT_SECRET is absent', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cfg1 = buildConfig({});
      const cfg2 = buildConfig({});
      expect(cfg1.jwtSecret).not.toBe(cfg2.jwtSecret);
    });
  });

  describe('JWT_SECRET warning (error path)', () => {
    it('emits a console.warn when JWT_SECRET is not provided', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      buildConfig({});
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain('JWT_SECRET');
    });

    it('does NOT warn when JWT_SECRET is provided', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      buildConfig({ JWT_SECRET: 'provided-secret' });
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
