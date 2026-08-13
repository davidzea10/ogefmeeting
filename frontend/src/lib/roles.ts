import {
  peutCreerReunion,
  peutApprouverReunion,
  peutApprouverReunionPourDirections,
  reunionDirectementPlanifiee,
  type FonctionOrganisation,
  type RoleUtilisateur,
  type Reunion,
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

/** Accès aux écrans Administration / Utilisateurs */
export function peutAccederAdministration(
  role: RoleUtilisateur | null | undefined,
): boolean {
  return role === 'administrateur';
}

/** Peut valider cette réunion précise (directions + statut). */
export function peutApprouverReunionPourReunion(
  role: RoleUtilisateur | null | undefined,
  fonction: string | null | undefined,
  profilDirectionId: string | null | undefined,
  reunion: Pick<
    Reunion,
    'statut' | 'direction_id' | 'direction_ids' | 'valide_par'
  >,
): boolean {
  if (reunion.statut !== 'en_attente_validation' || reunion.valide_par) {
    return false;
  }
  const directionIds =
    reunion.direction_ids ??
    (reunion.direction_id ? [reunion.direction_id] : []);
  return peutApprouverReunionPourDirections(
    role,
    fonction,
    directionIds,
    profilDirectionId,
  );
}

export function estSuperAdmin(role: RoleUtilisateur | null | undefined): boolean {
  return role === 'administrateur';
}
