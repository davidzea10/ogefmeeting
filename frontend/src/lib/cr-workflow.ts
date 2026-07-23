import type { RoleUtilisateur, StatutCompteRendu } from '@ogefmeeting/shared';

/** Rôles pouvant rédiger / soumettre un CR (permission CR_MODIFIER). */
const ROLES_MODIFIER: RoleUtilisateur[] = [
  'administrateur',
  'directeur',
  'secretaire',
];

/** Rôles pouvant valider / renvoyer en révision (permission CR_VALIDER). */
const ROLES_VALIDER: RoleUtilisateur[] = ['administrateur', 'directeur'];

export function peutModifierCr(role: RoleUtilisateur | null | undefined): boolean {
  return Boolean(role && ROLES_MODIFIER.includes(role));
}

export function peutValiderCr(role: RoleUtilisateur | null | undefined): boolean {
  return Boolean(role && ROLES_VALIDER.includes(role));
}

export function peutModifierContenuCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
): boolean {
  if (!peutModifierCr(role)) return false;
  if (statut === 'brouillon' || statut === 'en_revision') return true;
  // Directeur / admin : peuvent ajuster un CR déjà soumis avant validation
  if (statut === 'soumis' && peutValiderCr(role)) return true;
  return false;
}

export function peutSoumettreCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
): boolean {
  return peutModifierCr(role) && (statut === 'brouillon' || statut === 'en_revision');
}

export function peutApprouverCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
): boolean {
  return peutValiderCr(role) && statut === 'soumis';
}

export const LIBELLES_STATUT_CR: Record<StatutCompteRendu, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  en_revision: 'En révision',
  valide: 'Validé',
  archive: 'Archivé',
};

export function messageWorkflowCr(statut: StatutCompteRendu): string {
  switch (statut) {
    case 'brouillon':
      return 'Brouillon — rédigez le contenu puis soumettez-le pour validation.';
    case 'en_revision':
      return 'Renvoyé en révision — lisez les commentaires du directeur, corrigez, puis soumettez à nouveau.';
    case 'soumis':
      return 'Soumis — en attente de validation. Le directeur peut ajuster le contenu, commenter, valider ou renvoyer.';
    case 'valide':
      return 'Validé — compte rendu officiel (lecture seule). Vous pouvez l’archiver.';
    case 'archive':
      return 'Archivé — consultation uniquement.';
    default:
      return '';
  }
}

export function peutArchiverCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
): boolean {
  return peutValiderCr(role) && statut === 'valide';
}
