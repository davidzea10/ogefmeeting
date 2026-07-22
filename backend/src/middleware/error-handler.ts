import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { isAppError } from '../utils/errors.js';

/**
 * Middleware d'erreurs centralisé (4 arguments = signature Express error handler).
 * Doit être enregistré en dernier dans app.ts.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(error)) {
    logger.warn(
      { statusCode: error.statusCode, details: error.details },
      error.message,
    );

    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Sécurité : si ZodError arrive hors middleware validate
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Données de requête invalides.',
        details: {
          erreurs: error.issues.map((issue) => ({
            chemin: issue.path.join('.') || '(racine)',
            message: issue.message,
          })),
        },
      },
    });
    return;
  }

  logger.error({ err: error }, 'Erreur non gérée');

  res.status(500).json({
    success: false,
    error: {
      message: 'Erreur interne du serveur',
    },
  });
}
