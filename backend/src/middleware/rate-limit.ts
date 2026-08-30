import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/** Routes sollicitées en boucle pendant une réunion live (polling / sync). */
export function isLiveApiPath(req: Request): boolean {
  const path = req.path;
  if (path.startsWith('/api/transcriptions/live')) return true;
  if (/^\/api\/reunions\/[^/]+$/.test(path) && req.method === 'GET') return true;
  if (/^\/api\/reunions\/[^/]+\/(rejoindre-live|pause|reprendre|cloturer|annuler-live|ordre-du-jour)/.test(path)) {
    return true;
  }
  if (/^\/api\/reunions\/[^/]+\/participants\/[^/]+\/statut/.test(path)) return true;
  return false;
}

const rateLimitMessage = {
  success: false,
  error: { message: 'Trop de requêtes, réessayez plus tard.' },
};

/** Limite standard (auth, CR, admin…) — hors live. */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLiveApiPath(req),
  message: rateLimitMessage,
});

/**
 * Limite assouplie pour le live (~3 req/s en moyenne sur 15 min par IP).
 * Une réunion de 2 h avec STT + présences ne doit pas se bloquer seule.
 */
export const liveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 4000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !isLiveApiPath(req),
  message: rateLimitMessage,
});
