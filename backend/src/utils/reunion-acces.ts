import {
  peutApprouverReunion,
  peutApprouverReunionPourDirections,
  voitToutesLesReunions,
  type RoleUtilisateur,
} from '@ogefmeeting/shared';
import type { AuthUser } from '../types/auth.types.js';

/**
 * Membres « normaux » : uniquement réunions où ils sont participants
 * ou qu’ils ont créées. Validateurs / secrétaire / admin : tout.
 */
export function profilLimiteAuxParticipations(
  user: AuthUser | undefined,
): string | null {
  if (!user) return null;
  if (voitToutesLesReunions(user.role as RoleUtilisateur, user.fonction)) {
    return null;
  }
  return user.id;
}

export function utilisateurPeutApprouver(user: AuthUser | undefined): boolean {
  if (!user) return false;
  return peutApprouverReunion(user.role as RoleUtilisateur, user.fonction);
}

export function utilisateurPeutApprouverReunion(
  user: AuthUser | undefined,
  directionIds: string[],
): boolean {
  if (!user) return false;
  return peutApprouverReunionPourDirections(
    user.role as RoleUtilisateur,
    user.fonction,
    directionIds,
    user.direction_id,
  );
}

/**
 * Démarrer / pause / reprendre / clôturer :
 * ayant-droit (secrétaire, chef, direction, admin) OU organisateur (créateur).
 */
export function utilisateurPeutGererConduite(
  user: AuthUser | undefined,
  reunion: { cree_par?: string | null },
): boolean {
  if (!user) return false;
  if (utilisateurPeutApprouver(user)) return true;
  return Boolean(reunion.cree_par && reunion.cree_par === user.id);
}

/**
 * Rédiger / soumettre un compte rendu :
 * secrétariat / direction / admin, OU organisateur de la réunion.
 */
export function utilisateurPeutRedigerCompteRendu(
  user: AuthUser | undefined,
  reunion: { cree_par?: string | null },
): boolean {
  if (!user) return false;
  if (
    user.role === 'administrateur' ||
    user.role === 'directeur' ||
    user.role === 'secretaire'
  ) {
    return true;
  }
  if (utilisateurPeutApprouver(user)) return true;
  return Boolean(reunion.cree_par && reunion.cree_par === user.id);
}
