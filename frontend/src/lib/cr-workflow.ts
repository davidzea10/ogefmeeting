import type { RoleUtilisateur, StatutCompteRendu } from '@ogefmeeting/shared';

/** Rôles pouvant rédiger / soumettre un CR (permission CR_MODIFIER). */
const ROLES_MODIFIER: RoleUtilisateur[] = [
  'administrateur',
  'directeur',
  'secretaire',
];

/** Rôles pouvant valider / renvoyer en révision (permission CR_VALIDER). */
const ROLES_VALIDER: RoleUtilisateur[] = ['administrateur', 'directeur'];

export type NiveauDetailCr = 'simple' | 'detaille' | 'tres_detaille';

export type ContexteOrganisateurCr = {
  userId?: string | null;
  organisateurId?: string | null;
};

export const LIBELLES_NIVEAU_DETAIL_CR: Record<NiveauDetailCr, string> = {
  simple: 'Compte rendu simple',
  detaille: 'Compte rendu détaillé',
  tres_detaille: 'Compte rendu très détaillé',
};

export const DESCRIPTIONS_NIVEAU_DETAIL_CR: Record<NiveauDetailCr, string> = {
  simple: 'Synthèse courte — points essentiels et sous-éléments en bref.',
  detaille: 'Standard — un sous-point par projet ou sujet cité, avec développement.',
  tres_detaille: 'Exhaustif — reprend tout le contenu de la transcription.',
};

/** Secrétariat / direction / admin. */
export function peutModifierCr(role: RoleUtilisateur | null | undefined): boolean {
  return Boolean(role && ROLES_MODIFIER.includes(role));
}

/** Rôle CR classique OU organisateur de la réunion. */
export function peutRedigerCr(
  role: RoleUtilisateur | null | undefined,
  ctx?: ContexteOrganisateurCr,
): boolean {
  if (peutModifierCr(role)) return true;
  return Boolean(
    ctx?.userId && ctx.organisateurId && ctx.userId === ctx.organisateurId,
  );
}

export function peutValiderCr(role: RoleUtilisateur | null | undefined): boolean {
  return Boolean(role && ROLES_VALIDER.includes(role));
}

export function peutModifierContenuCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
  ctx?: ContexteOrganisateurCr,
): boolean {
  if (!peutRedigerCr(role, ctx)) return false;
  if (statut === 'archive') return false;
  return (
    statut === 'brouillon' ||
    statut === 'en_revision' ||
    statut === 'soumis' ||
    statut === 'valide'
  );
}

export function peutSoumettreCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
  ctx?: ContexteOrganisateurCr,
): boolean {
  return (
    peutRedigerCr(role, ctx) && (statut === 'brouillon' || statut === 'en_revision')
  );
}

/** Rédacteur / organisateur : retirer un CR soumis → brouillon. */
export function peutAnnulerSoumissionCr(
  role: RoleUtilisateur | null | undefined,
  statut: StatutCompteRendu,
  ctx?: ContexteOrganisateurCr,
): boolean {
  return peutRedigerCr(role, ctx) && statut === 'soumis';
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
      return 'Soumis — en attente de validation. Vous pouvez encore annuler la soumission pour revenir en brouillon. Le directeur peut ajuster, valider ou renvoyer.';
    case 'valide':
      return 'Validé — rapport officiel. Vous pouvez encore réajuster le contenu ; le PDF sera régénéré à l’export.';
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

/** Organisateur / secrétariat / direction : envoyer le rapport validé aux participants. */
export function peutEnvoyerRapportParticipants(
  role: RoleUtilisateur | null | undefined,
  statutCr: StatutCompteRendu,
  statutReunion: string | null | undefined,
  userId: string | null | undefined,
  organisateurId: string | null | undefined,
): boolean {
  if (statutCr !== 'valide' && statutCr !== 'archive') return false;
  if (statutReunion !== 'cloturee') return false;
  if (role === 'administrateur' || role === 'directeur' || role === 'secretaire') {
    return true;
  }
  return Boolean(userId && organisateurId && userId === organisateurId);
}
