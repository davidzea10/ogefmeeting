import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isCorsOriginAllowed } from './config/env.js';
import { logger } from './lib/logger.js';
import { generalRateLimiter, liveRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';

/**
 * Fabrique l'application Express (MVC).
 * Middlewares globaux → routes → 404 → erreurs.
 */
export function createApp(): Express {
  const app = express();

  // --- Sécurité & performance ---
  app.use(
    helmet({
      // API appelée depuis Vercel (origine différente) : ne pas bloquer la lecture des réponses
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin)) {
          callback(null, origin ?? true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- Limitation de débit (live assoupli, reste de l'API protégé) ---
  app.use(liveRateLimiter);
  app.use(generalRateLimiter);

  // --- Logger HTTP (Pino) ---
  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );

  // --- Routes API (MVC) ---
  app.use('/api', apiRouter);

  // --- 404 & erreurs (toujours en dernier) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
