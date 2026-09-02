import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // behind Render/Railway/Vercel proxies

  // ── Security headers (helmet) ──────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ── CORS: allow the configured client origin(s) ────────────────────────
  const allowed = env.clientUrl.split(',').map((s) => s.trim());
  app.use(cors({
    origin(origin, cb) {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(null, env.isProd ? false : true);
    },
    credentials: true,
  }));

  // ── Body parsing (also mitigates oversized-payload DoS) ────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (!env.isProd) app.use(morgan('dev'));

  // ── Rate limiting on the API surface ───────────────────────────────────
  app.use('/api', apiLimiter);

  // ── Routes ─────────────────────────────────────────────────────────────
  app.get('/', (_req, res) =>
    res.json({ service: 'VetConnect Ekiti API', docs: '/api/health', version: '1.0.0' })
  );
  app.use('/api', apiRouter);

  // ── 404 + error handler ────────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
