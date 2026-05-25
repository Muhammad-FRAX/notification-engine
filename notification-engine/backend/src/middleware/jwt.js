import { verifyAdminToken } from '../util/jwt.js';
import { HttpError } from '../util/HttpError.js';
import config from '../config.js';

/**
 * Protects /api/admin/* routes.
 * Expects: Authorization: Bearer <token>
 * Attaches req.admin = { username } on success.
 */
export function jwtAuth(req, res, next) {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(new HttpError(401, 'missing_token', 'Authorization: Bearer <token> is required.'));
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = verifyAdminToken(token, config.jwtSecret);
    } catch {
      return next(new HttpError(401, 'invalid_token', 'Token is invalid or expired.'));
    }

    req.admin = { username: payload.sub };
    next();
  } catch (err) {
    next(err);
  }
}
