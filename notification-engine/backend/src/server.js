import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import config from './config.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.routes.js';
import { initProxyAccount } from './integrations/msal.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Security headers
app.use(helmet());
app.use(cors());

// Request identification — attached before any logging or routing
app.use(requestId);

// Request logging
app.use((req, res, next) => {
  console.log(`[${req.id}] ${req.method} ${req.path}`);
  next();
});

// Body parsing — 1 gb cap so large image attachments pass through
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Global rate limiter — applied to all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many requests; try again later.' },
});
app.use(globalLimiter);

// Auth rate limiter — tighter window for the admin login route
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many login attempts; try again in a minute.' },
});
app.use('/api/admin/auth', authLimiter);

// Routes
app.use(healthRouter);

// Serve compiled frontend in production
if (config.nodeEnv === 'production') {
  const distPath = join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// Centralised error handler — must be last
app.use(errorHandler);

app.listen(config.port, async () => {
  console.log(`[server] Notification Engine listening on port ${config.port} (${config.nodeEnv})`);
  await initProxyAccount();
});

export default app;
