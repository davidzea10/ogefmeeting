import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/errors.js';

type RequestTarget = 'body' | 'query' | 'params';

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

function formatZodIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({
    chemin: issue.path.join('.') || '(racine)',
    message: issue.message,
  }));
}

/**
 * Middleware de validation Zod.
 * Stocke le résultat dans req.validated[target] (req.query n'est pas toujours writable).
 */
export function validate(schema: ZodType, target: RequestTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(
        new AppError(400, 'Données de requête invalides.', {
          erreurs: formatZodIssues(result.error),
        }),
      );
      return;
    }

    req.validated = {
      ...req.validated,
      [target]: result.data,
    };

    // body et params sont mutables ; query peut être en lecture seule
    if (target === 'body' || target === 'params') {
      (req as Request & Record<'body' | 'params', unknown>)[target] = result.data;
    }

    next();
  };
}

export const validateBody = (schema: ZodType) => validate(schema, 'body');
export const validateQuery = (schema: ZodType) => validate(schema, 'query');
export const validateParams = (schema: ZodType) => validate(schema, 'params');
