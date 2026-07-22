import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RoleUtilisateur } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { env } from '../config/env.js';
import { getSupabaseAdmin, verifyAccessToken } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import type { AuthUser } from '../types/auth.types.js';
import { AppError } from '../utils/errors.js';
import { roleAutorise, type Permission } from '../utils/permissions.js';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token.trim();
}

/**
 * Attache req.user si un JWT valide est présent.
 * Ne bloque JAMAIS la requête (même token invalide → continue sans user).
 */
export const attachAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }

    req.accessToken = token;
    const authUser = await verifyAccessToken(token);

    if (!authUser) {
      // Token présent mais invalide/expiré → on continue sans bloquer
      logger.debug('JWT fourni mais invalide ou expiré — requête poursuivie sans user');
      next();
      return;
    }

    const supabase = getSupabaseAdmin();
    type ProfilAuth = {
      role: RoleUtilisateur;
      prenom: string;
      nom: string;
      direction_id: string | null;
      email: string;
      est_actif: boolean;
    };

    let profil: ProfilAuth | null = null;

    if (supabase) {
      const { data } = await supabase
        .from(TABLES.profils)
        .select('role, prenom, nom, direction_id, email, est_actif')
        .eq('id', authUser.id)
        .maybeSingle();

      profil = (data as ProfilAuth | null) ?? null;

      if (profil && !profil.est_actif) {
        logger.debug('Compte désactivé — JWT ignoré');
        next();
        return;
      }
    }

    const user: AuthUser = {
      id: authUser.id,
      email: profil?.email ?? authUser.email ?? '',
      role: profil?.role ?? 'participant',
      prenom: profil?.prenom ?? 'Utilisateur',
      nom: profil?.nom ?? 'OGEFREM',
      direction_id: profil?.direction_id ?? null,
      auth: authUser,
    };

    req.user = user;
    next();
  } catch (error) {
    // Tolérance maximale : une erreur auth ne doit pas faire planter l'API
    logger.warn({ err: error }, 'attachAuth — erreur ignorée (mode non bloquant)');
    next();
  }
};

/**
 * Exige un utilisateur authentifié UNIQUEMENT si AUTH_ENFORCED=true.
 * Sinon : passe toujours (déploiement / démo / usage libre).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!env.AUTH_ENFORCED) {
    next();
    return;
  }

  if (!req.user) {
    next(new AppError(401, 'Authentification requise. Fournissez un Bearer token valide.'));
    return;
  }

  next();
}

/**
 * Vérifie les rôles UNIQUEMENT si AUTH_ENFORCED=true et qu'un user est présent.
 * Si auth non forcée → jamais de blocage.
 */
export function requireRoles(...roles: RoleUtilisateur[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!env.AUTH_ENFORCED) {
      next();
      return;
    }

    if (!req.user) {
      next(new AppError(401, 'Authentification requise.'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        new AppError(403, 'Accès refusé pour votre rôle.', {
          role: req.user.role,
          roles_autorises: roles,
        }),
      );
      return;
    }

    next();
  };
}

/**
 * Vérifie une ou plusieurs permissions (ET logique) si AUTH_ENFORCED=true.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!env.AUTH_ENFORCED) {
      next();
      return;
    }

    if (!req.user) {
      next(new AppError(401, 'Authentification requise.'));
      return;
    }

    const autorise = permissions.every((permission) => roleAutorise(req.user!.role, permission));

    if (!autorise) {
      next(
        new AppError(403, 'Permission insuffisante pour cette action.', {
          role: req.user.role,
          permissions_requises: permissions,
        }),
      );
      return;
    }

    next();
  };
}
