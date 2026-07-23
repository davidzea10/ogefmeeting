import type { FonctionOrganisation, RoleUtilisateur } from '@ogefmeeting/shared';
import { FONCTIONS_CREATION_REUNION, peutCreerReunion } from '@ogefmeeting/shared';

/**
 * Permissions fines — utilisées quand AUTH_ENFORCED=true.
 * Quand AUTH_ENFORCED=false, aucune permission ne bloque.
 */
export const PERMISSIONS = {
  REUNIONS_LIRE: 'reunions:lire',
  REUNIONS_CREER: 'reunions:creer',
  REUNIONS_MODIFIER: 'reunions:modifier',
  REUNIONS_ARCHIVER: 'reunions:archiver',
  REUNIONS_DEMARRER: 'reunions:demarrer',

  CR_LIRE: 'comptes_rendus:lire',
  CR_CREER: 'comptes_rendus:creer',
  CR_MODIFIER: 'comptes_rendus:modifier',
  CR_VALIDER: 'comptes_rendus:valider',

  ACTIONS_LIRE: 'actions:lire',
  ACTIONS_GERER: 'actions:gerer',

  DECISIONS_LIRE: 'decisions:lire',
  DECISIONS_GERER: 'decisions:gerer',

  PROFILS_LIRE: 'profils:lire',
  PROFILS_MODIFIER: 'profils:modifier',
  UTILISATEURS_INVITER: 'utilisateurs:inviter',

  DIRECTIONS_GERER: 'directions:gerer',
  MODELES_GERER: 'modeles:gerer',
  PARAMETRES_GERER: 'parametres:gerer',
  RECHERCHE: 'recherche:utiliser',
  AUDIT_LIRE: 'audit:lire',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Permissions accordées via fonction organique (chef / sous-dir / dir) */
const PERMISSIONS_FONCTION_GESTION: Permission[] = [
  PERMISSIONS.REUNIONS_CREER,
  PERMISSIONS.REUNIONS_MODIFIER,
  PERMISSIONS.REUNIONS_DEMARRER,
];

const MATRICE: Record<RoleUtilisateur, Permission[]> = {
  administrateur: Object.values(PERMISSIONS),

  directeur: [
    PERMISSIONS.REUNIONS_LIRE,
    PERMISSIONS.REUNIONS_CREER,
    PERMISSIONS.REUNIONS_MODIFIER,
    PERMISSIONS.REUNIONS_ARCHIVER,
    PERMISSIONS.REUNIONS_DEMARRER,
    PERMISSIONS.CR_LIRE,
    PERMISSIONS.CR_CREER,
    PERMISSIONS.CR_MODIFIER,
    PERMISSIONS.CR_VALIDER,
    PERMISSIONS.ACTIONS_LIRE,
    PERMISSIONS.ACTIONS_GERER,
    PERMISSIONS.DECISIONS_LIRE,
    PERMISSIONS.DECISIONS_GERER,
    PERMISSIONS.PROFILS_LIRE,
    PERMISSIONS.RECHERCHE,
    PERMISSIONS.AUDIT_LIRE,
  ],

  secretaire: [
    PERMISSIONS.REUNIONS_LIRE,
    PERMISSIONS.REUNIONS_CREER,
    PERMISSIONS.REUNIONS_MODIFIER,
    PERMISSIONS.REUNIONS_DEMARRER,
    PERMISSIONS.CR_LIRE,
    PERMISSIONS.CR_CREER,
    PERMISSIONS.CR_MODIFIER,
    PERMISSIONS.ACTIONS_LIRE,
    PERMISSIONS.ACTIONS_GERER,
    PERMISSIONS.DECISIONS_LIRE,
    PERMISSIONS.DECISIONS_GERER,
    PERMISSIONS.PROFILS_LIRE,
    PERMISSIONS.RECHERCHE,
  ],

  participant: [
    PERMISSIONS.REUNIONS_LIRE,
    PERMISSIONS.REUNIONS_CREER,
    PERMISSIONS.REUNIONS_MODIFIER,
    PERMISSIONS.CR_LIRE,
    PERMISSIONS.ACTIONS_LIRE,
    PERMISSIONS.ACTIONS_GERER,
    PERMISSIONS.DECISIONS_LIRE,
    PERMISSIONS.PROFILS_LIRE,
    PERMISSIONS.RECHERCHE,
  ],

  lecteur: [
    PERMISSIONS.REUNIONS_LIRE,
    PERMISSIONS.CR_LIRE,
    PERMISSIONS.ACTIONS_LIRE,
    PERMISSIONS.DECISIONS_LIRE,
    PERMISSIONS.PROFILS_LIRE,
    PERMISSIONS.RECHERCHE,
  ],
};

export function roleAutorise(role: RoleUtilisateur, permission: Permission): boolean {
  return MATRICE[role].includes(permission);
}

export function autorisePermission(
  role: RoleUtilisateur,
  permission: Permission,
  fonction?: string | null,
): boolean {
  if (roleAutorise(role, permission)) return true;

  const fonctionGestion =
    Boolean(fonction) &&
    (FONCTIONS_CREATION_REUNION as readonly string[]).includes(fonction!);

  if (fonctionGestion && PERMISSIONS_FONCTION_GESTION.includes(permission)) {
    return true;
  }

  return false;
}

export function permissionsPourRole(
  role: RoleUtilisateur,
  fonction?: string | null,
): Permission[] {
  const base = [...MATRICE[role]];
  if (
    fonction &&
    (FONCTIONS_CREATION_REUNION as readonly string[]).includes(fonction)
  ) {
    for (const p of PERMISSIONS_FONCTION_GESTION) {
      if (!base.includes(p)) base.push(p);
    }
  }
  return base;
}

export { peutCreerReunion };
export type { FonctionOrganisation };
