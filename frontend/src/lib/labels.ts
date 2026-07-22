import type { Direction, StatutReunion, TypeReunion } from '@ogefmeeting/shared';

export const LIBELLES_STATUT: Record<StatutReunion, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  cloturee: 'Clôturée',
  archivee: 'Archivée',
};

export const LIBELLES_TYPE: Record<TypeReunion, string> = {
  conseil_direction: 'Conseil de direction',
  technique: 'Technique',
  operationnel: 'Opérationnel',
  partenaire: 'Partenaires',
  autre: 'Autre',
};

export const LIBELLES_PARTICIPANT: Record<string, string> = {
  invite: 'Invité',
  confirme: 'Confirmé',
  present: 'Présent',
  absent: 'Absent',
};

export function formatDateHeure(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateCourte(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Affiche le sigle puis le nom : « DGIT — Direction de Gestion… » */
export function formatDirection(direction: Pick<Direction, 'nom' | 'code'>): string {
  return direction.code ? `${direction.code} — ${direction.nom}` : direction.nom;
}

/** Début/fin de journée en ISO pour filtres API */
export function debutJourneeISO(dateLocal: string): string {
  return new Date(`${dateLocal}T00:00:00`).toISOString();
}

export function finJourneeISO(dateLocal: string): string {
  return new Date(`${dateLocal}T23:59:59.999`).toISOString();
}
