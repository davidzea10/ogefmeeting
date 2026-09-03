import type { FonctionOrganisation, Profil, RoleUtilisateur } from '@ogefmeeting/shared';
import { roleDepuisFonction } from '@ogefmeeting/shared';
import type { AuthUser } from '../types/auth.types.js';
import { AppError } from './errors.js';

export function estAdministrateur(user: AuthUser | undefined): boolean {
  return user?.role === 'administrateur';
}

/** Directeur / sous-directeur rattachés à une direction, ou administrateur. */
export function peutGererMembresDirection(user: AuthUser | undefined): boolean {
  if (!user) return false;
  if (estAdministrateur(user)) return true;
  if (!user.direction_id) return false;
  return user.fonction === 'directeur' || user.fonction === 'sous_directeur';
}

export function assertPeutGererMembresDirection(user: AuthUser | undefined): void {
  if (!peutGererMembresDirection(user)) {
    throw new AppError(403, 'Accès réservé à l’administrateur ou à la direction.');
  }
}

export function assertMemeDirection(user: AuthUser, cible: Pick<Profil, 'direction_id'>): void {
  if (estAdministrateur(user)) return;
  if (!user.direction_id || cible.direction_id !== user.direction_id) {
    throw new AppError(403, 'Ce membre n’appartient pas à votre direction.');
  }
}

export function filtrerDirectionPourListe(
  user: AuthUser | undefined,
  directionIdQuery?: string | null,
): string | undefined {
  if (!user) return directionIdQuery ?? undefined;
  if (estAdministrateur(user)) return directionIdQuery ?? undefined;
  if (peutGererMembresDirection(user)) return user.direction_id ?? undefined;
  return directionIdQuery ?? undefined;
}

const ROLES_INTERDITS_DIRECTION = new Set<RoleUtilisateur>([
  'administrateur',
  'secretaire',
]);

export function validerInvitationDirection(
  user: AuthUser,
  input: {
    direction_id?: string | null;
    role?: RoleUtilisateur;
    fonction?: string | null;
  },
): { direction_id: string | null; role: RoleUtilisateur; fonction: FonctionOrganisation | null } {
  if (estAdministrateur(user)) {
    const fonction = input.fonction as FonctionOrganisation | null | undefined;
    return {
      direction_id: input.direction_id ?? null,
      role: input.role ?? roleDepuisFonction(fonction),
      fonction: fonction ?? null,
    };
  }

  if (!user.direction_id) {
    throw new AppError(403, 'Votre compte n’est rattaché à aucune direction.');
  }

  const role = roleDepuisFonction(input.fonction);
  if (ROLES_INTERDITS_DIRECTION.has(role)) {
    throw new AppError(403, 'Vous ne pouvez pas créer ce type de compte.');
  }

  return {
    direction_id: user.direction_id,
    role,
    fonction: (input.fonction ?? 'agent') as FonctionOrganisation,
  };
}

export function filtrerModificationDirection(
  user: AuthUser,
  input: Record<string, unknown>,
  cible: Profil,
): Record<string, unknown> {
  assertMemeDirection(user, cible);

  if (estAdministrateur(user)) return input;

  const allowed = ['email', 'prenom', 'nom', 'fonction', 'matricule'] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in input && input[key] !== undefined) {
      patch[key] = input[key];
    }
  }

  if (patch.fonction !== undefined) {
    const role = roleDepuisFonction(patch.fonction as string | null);
    if (ROLES_INTERDITS_DIRECTION.has(role)) {
      throw new AppError(403, 'Fonction ou rôle non autorisé pour votre direction.');
    }
    patch.role = role;
  }

  return patch;
}
