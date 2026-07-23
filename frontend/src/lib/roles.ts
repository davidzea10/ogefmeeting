import {
  peutCreerReunion,
  peutApprouverReunion,
  reunionDirectementPlanifiee,
  type FonctionOrganisation,
  type RoleUtilisateur,
} from '@ogefmeeting/shared';

export const LIBELLES_ROLE: Record<RoleUtilisateur, string> = {
  administrateur: 'Administrateur',
  directeur: 'Directeur',
  secretaire: 'Secrétaire',
  participant: 'Membre',
  lecteur: 'Lecteur',
};

export const LIBELLES_FONCTION: Record<FonctionOrganisation, string> = {
  agent: 'Agent',
  chef_service: 'Chef de service',
  sous_directeur: 'Sous-directeur',
  directeur: 'Directeur',
};

export function peutValiderCrRole(role: RoleUtilisateur | null | undefined): boolean {
  return role === 'administrateur' || role === 'directeur';
}

export function peutCreerReunionRole(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
): boolean {
  return peutCreerReunion(role, fonction);
}

export function reunionSansValidation(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
): boolean {
  return reunionDirectementPlanifiee(role, fonction);
}

export function peutApprouverReunionRole(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
): boolean {
  return peutApprouverReunion(role, fonction);
}

export function estSuperAdmin(role: RoleUtilisateur | null | undefined): boolean {
  return role === 'administrateur';
}
