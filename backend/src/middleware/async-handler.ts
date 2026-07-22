import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Enveloppe un contrôleur async pour transmettre les erreurs
 * au middleware d'erreur centralisé (évite les try/catch partout).
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
