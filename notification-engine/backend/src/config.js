import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Builds a frozen config object from the given env map.
 * Separating this from process.env makes it testable as a pure function.
 */
export function buildConfig(env = process.env) {
  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    jwtSecret = randomBytes(32).toString('hex');
    console.warn(
      '[config] JWT_SECRET is not set. A temporary secret was generated — ' +
      'tokens will NOT survive a process restart. Set JWT_SECRET before deploying.'
    );
  }

  return Object.freeze({
    port: parseInt(env.PORT || '5000', 10),
    nodeEnv: env.NODE_ENV || 'development',

    databaseUrl: env.DATABASE_URL || '',

    entraClientId: env.ENTRA_CLIENT_ID || '5935a6c7-dea3-4ff2-adf0-fb90e27e2f3c',
    entraTenantId: env.ENTRA_TENANT_ID || 'a7853600-5c09-49fd-adca-53fa929e9645',
    msalCacheDir: env.MSAL_CACHE_DIR || '/data/msal',

    adminUsername: env.ADMIN_USERNAME || 'admin',
    adminPassword: env.ADMIN_PASSWORD || 'admin123',
    jwtSecret,
    jwtTtlSeconds: 7 * 24 * 60 * 60,

    defaultSourceRpm: parseInt(env.DEFAULT_SOURCE_RPM || '60', 10),
    retryMaxAttempts: parseInt(env.RETRY_MAX_ATTEMPTS || '5', 10),
    retryBaseDelayMs: parseInt(env.RETRY_BASE_DELAY_MS || '30000', 10),
  });
}

export default buildConfig();
