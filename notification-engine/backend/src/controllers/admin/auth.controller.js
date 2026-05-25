import { timingSafeEqual } from 'node:crypto';
import config from '../../config.js';
import { signAdminToken } from '../../util/jwt.js';
import { HttpError } from '../../util/HttpError.js';

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run the comparison to avoid timing leak on length difference
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return next(new HttpError(400, 'invalid_body', 'username and password are required strings.'));
    }

    const usernameMatch = safeEqual(username, config.adminUsername);
    const passwordMatch = safeEqual(password, config.adminPassword);

    if (!usernameMatch || !passwordMatch) {
      return next(new HttpError(401, 'invalid_credentials', 'Invalid username or password.'));
    }

    const { token, expires_at } = signAdminToken(username, config.jwtSecret, config.jwtTtlSeconds);
    res.json({ token, expires_at });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ username: req.admin.username });
}
