import * as sourcesRepo from '../repositories/sources.repo.js';
import { verifyApiKey } from '../util/hash.js';
import { HttpError } from '../util/HttpError.js';

// In-memory per-source fixed-window rate limit: sourceId -> { count, windowStart }
const rateLimitWindows = new Map();
const WINDOW_MS = 60_000;

/**
 * Returns true if the source has exceeded its requests-per-minute limit.
 * Exported for unit testing.
 */
export function isRateLimited(sourceId, limitRpm) {
  const now = Date.now();
  const entry = rateLimitWindows.get(sourceId);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rateLimitWindows.set(sourceId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > limitRpm;
}

export async function apiKeyAuth(req, res, next) {
  try {
    const key = req.headers['x-api-key'];
    if (!key) {
      return next(new HttpError(401, 'missing_api_key', 'X-API-Key header is required.'));
    }

    const prefix = key.slice(0, 8);
    const sources = await sourcesRepo.findAll({ activeOnly: true });

    let matched = null;
    for (const source of sources) {
      if (source.api_key_prefix === prefix) {
        const valid = await verifyApiKey(source.api_key_hash, key);
        if (valid) {
          matched = source;
          break;
        }
      }
    }

    if (!matched) {
      return next(new HttpError(401, 'invalid_api_key', 'Invalid or unrecognized API key.'));
    }

    if (isRateLimited(matched.id, matched.rate_limit_rpm)) {
      return next(new HttpError(429, 'rate_limited', 'Source rate limit exceeded. Try again in a minute.'));
    }

    req.source = matched;
    await sourcesRepo.touchLastUsed(matched.id);
    next();
  } catch (err) {
    next(err);
  }
}
