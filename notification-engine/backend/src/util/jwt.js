import jwt from 'jsonwebtoken';

/**
 * Signs an HS256 JWT for the admin user.
 * Returns { token, expires_at } where expires_at is an ISO string.
 */
export function signAdminToken(username, secret, ttlSeconds) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const token = jwt.sign({ sub: username, exp }, secret, { algorithm: 'HS256' });
  return { token, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * Verifies an HS256 JWT and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyAdminToken(token, secret) {
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}
