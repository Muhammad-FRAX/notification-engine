import { HttpError } from '../util/HttpError.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }

  console.error(`[${req.id}] Unhandled error:`, err);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'internal_error',
    message: isDev ? err.message : 'Internal server error',
  });
}
