import type {
  ParticipantReunion,
  ReunionDetail,
  StatutParticipant,
} from '@ogefmeeting/shared';

/** Statuts autorisés à entrer en mode live. */
export function statutAutoriseLive(statut: StatutParticipant | undefined | null): boolean {
  return statut === 'confirme' || statut === 'present';
}

type ReunionPourLive = Pick<ReunionDetail, 'cree_par' | 'participants'>;

/**
 * Peut rejoindre le live : organisateur / admin, ou participant confirmé (ou déjà présent).
 * Un simple « invite » ou « absent » doit d’abord confirmer l’invitation.
 */
export function peutRejoindreLive(
  reunion: ReunionPourLive,
  profilId: string | null | undefined,
  options?: { estAdmin?: boolean },
): boolean {
  if (!profilId) return false;
  if (options?.estAdmin) return true;
  if (reunion.cree_par && reunion.cree_par === profilId) return true;
  const moi = reunion.participants.find((p) => p.profil_id === profilId);
  return statutAutoriseLive(moi?.statut);
}

export function monStatutParticipant(
  reunion: Pick<ReunionDetail, 'participants'>,
  profilId: string | null | undefined,
): ParticipantReunion | undefined {
  if (!profilId) return undefined;
  return reunion.participants.find((p) => p.profil_id === profilId);
}
