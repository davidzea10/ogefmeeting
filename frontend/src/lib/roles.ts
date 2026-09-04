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

/** Ordre hiérarchique croissant (0 = plus haut). */
export const ORDRE_HIERARCHIE_FONCTION: Record<string, number> = {
  directeur: 0,
  sous_directeur: 1,
  chef_service: 2,
  agent: 3,
};

export function rangHierarchieFonction(
  fonction: string | null | undefined,
): number {
  if (!fonction) return 99;
  return ORDRE_HIERARCHIE_FONCTION[fonction] ?? 50;
}

export function libelleFonction(fonction: string | null | undefined): string {
  if (!fonction) return '—';
  if ((fonction as FonctionOrganisation) in LIBELLES_FONCTION) {
    return LIBELLES_FONCTION[fonction as FonctionOrganisation];
  }
  return fonction;
}

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

/**
 * Modifier une réunion :
 * - ayant-droit : toutes
 * - agent : uniquement s’il en est le créateur
 */
export function peutModifierReunionRole(
  role: RoleUtilisateur | null | undefined,
  fonction: string | null | undefined,
  userId: string | null | undefined,
  reunion: Pick<Reunion, 'cree_par'>,
): boolean {
  if (peutApprouverReunion(role, fonction)) return true;
  return Boolean(userId && reunion.cree_par && reunion.cree_par === userId);
}

/**
 * Archiver / démarrer / clôturer / pause :
 * ayant-droit OU organisateur (créateur de la réunion).
 */
export function peutGererReunionRole(
  role: RoleUtilisateur | null | undefined,
  fonction: string | null | undefined,
  userId?: string | null,
  reunion?: Pick<Reunion, 'cree_par'> | null,
): boolean {
  if (peutApprouverReunion(role, fonction)) return true;
  return Boolean(
    userId && reunion?.cree_par && reunion.cree_par === userId,
  );
}

/**
 * Voir audio + transcription après clôture :
 * administrateur, organisateur, ayant-droit, ou participant invité
 * (lorsque la réunion est clôturée / archivée).
 */
export function peutVoirArchivesMediaRole(
  role: RoleUtilisateur | null | undefined,
  fonction: string | null | undefined,
  userId: string | null | undefined,
  reunion: Pick<Reunion, 'cree_par' | 'statut'> & {
    participants?: { profil_id: string }[];
  },
): boolean {
  if (role === 'administrateur') return true;
  if (userId && reunion.cree_par && userId === reunion.cree_par) return true;
  if (peutApprouverReunion(role, fonction)) return true;
  const cloturee =
    reunion.statut === 'cloturee' || reunion.statut === 'archivee';
  if (!cloturee || !userId) return false;
  return Boolean(
    reunion.participants?.some((p) => p.profil_id === userId),
  );
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

/** Directeur / sous-directeur rattachés à une direction, ou administrateur. */
export function peutGererMembresDirection(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
  directionId?: string | null,
): boolean {
  if (role === 'administrateur') return true;
  if (!directionId) return false;
  return fonction === 'directeur' || fonction === 'sous_directeur';
}
