import type { ParticipantReunion, Reunion, StatutParticipant } from '@ogefmeeting/shared';

export type TriPresenceLive = 'arrivee' | 'alphabetique' | 'statut';

const ORDRE_STATUT: Record<StatutParticipant, number> = {
  present: 0,
  confirme: 1,
  invite: 2,
  absent: 3,
};

/** Sur la page live, le participant connecté est toujours affiché « présent ». */
export function appliquerPresenceLocale(
  participants: ParticipantReunion[],
  profilId: string | undefined,
  enLive: boolean,
): ParticipantReunion[] {
  if (!profilId || !enLive) return participants;
  const maintenant = new Date().toISOString();
  return participants.map((p) =>
    p.profil_id === profilId
      ? {
          ...p,
          statut: 'present',
          present_le: p.present_le ?? maintenant,
        }
      : p,
  );
}

export function trierParticipantsLive(
  participants: ParticipantReunion[],
  reunion: Reunion,
  tri: TriPresenceLive,
  nomParticipant: (profilId: string) => string,
): ParticipantReunion[] {
  return [...participants].sort((a, b) => {
    const aOrg = a.profil_id === reunion.cree_par ? 0 : 1;
    const bOrg = b.profil_id === reunion.cree_par ? 0 : 1;
    if (aOrg !== bOrg) return aOrg - bOrg;

    if (tri === 'arrivee') {
      const aPres = a.statut === 'present' ? 0 : 1;
      const bPres = b.statut === 'present' ? 0 : 1;
      if (aPres !== bPres) return aPres - bPres;
      if (a.statut === 'present' && b.statut === 'present') {
        const aT = a.present_le ? new Date(a.present_le).getTime() : Number.MAX_SAFE_INTEGER;
        const bT = b.present_le ? new Date(b.present_le).getTime() : Number.MAX_SAFE_INTEGER;
        if (aT !== bT) return aT - bT;
      }
      return nomParticipant(a.profil_id).localeCompare(nomParticipant(b.profil_id), 'fr');
    }

    if (tri === 'statut') {
      const aS = ORDRE_STATUT[a.statut] ?? 9;
      const bS = ORDRE_STATUT[b.statut] ?? 9;
      if (aS !== bS) return aS - bS;
      if (a.statut === 'present' && b.statut === 'present') {
        const aT = a.present_le ? new Date(a.present_le).getTime() : Number.MAX_SAFE_INTEGER;
        const bT = b.present_le ? new Date(b.present_le).getTime() : Number.MAX_SAFE_INTEGER;
        if (aT !== bT) return aT - bT;
      }
      return nomParticipant(a.profil_id).localeCompare(nomParticipant(b.profil_id), 'fr');
    }

    return nomParticipant(a.profil_id).localeCompare(nomParticipant(b.profil_id), 'fr');
  });
}
