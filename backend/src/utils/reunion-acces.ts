import {
  peutApprouverReunion,
  voitToutesLesReunions,
  type RoleUtilisateur,
} from '@ogefmeeting/shared';
import type { AuthUser } from '../types/auth.types.js';

/**
 * Membres « normaux » : uniquement réunions où ils sont participants
 * ou qu’ils ont créées. Direction / secrétaire / admin : tout.
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
