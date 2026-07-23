import type {
  Direction,
  ModeleCompteRendu,
  PaginatedResult,
  ParticipantReunion,
  PointOrdreJour,
  Profil,
  Reunion,
  ReunionDetail,
  StatutReunion,
  TypeReunion,
} from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export type ListerReunionsParams = {
  page?: number;
  limite?: number;
  tri?: 'date_prevue' | 'titre' | 'statut' | 'cree_le';
  ordre?: 'asc' | 'desc';
  statut?: StatutReunion;
  type_reunion?: TypeReunion;
  direction_id?: string;
  participant_id?: string;
  date_apres?: string;
  date_avant?: string;
  recherche?: string;
};

export type CreerReunionPayload = {
  titre: string;
  description?: string | null;
  type_reunion?: TypeReunion;
  date_prevue: string;
  lieu?: string | null;
  direction_id?: string | null;
  modele_id?: string | null;
};

export type ModifierReunionPayload = Partial<CreerReunionPayload>;

export function listerReunions(params: ListerReunionsParams = {}) {
  return apiFetch<PaginatedResult<Reunion>>(`/api/reunions${toQueryString(params)}`);
}

export function obtenirReunion(id: string) {
  return apiFetch<ReunionDetail>(`/api/reunions/${id}`);
}

export function creerReunion(payload: CreerReunionPayload) {
  return apiFetch<Reunion>('/api/reunions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierReunion(id: string, payload: ModifierReunionPayload) {
  return apiFetch<Reunion>(`/api/reunions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function demarrerReunion(id: string) {
  return apiFetch<Reunion>(`/api/reunions/${id}/demarrer`, { method: 'POST' });
}

export function approuverReunion(id: string) {
  return apiFetch<Reunion>(`/api/reunions/${id}/approuver`, { method: 'POST' });
}

export function refuserReunion(id: string) {
  return apiFetch<Reunion>(`/api/reunions/${id}/refuser`, { method: 'POST' });
}

export function archiverReunion(id: string) {
  return apiFetch<Reunion>(`/api/reunions/${id}`, { method: 'DELETE' });
}

export function gererParticipants(
  id: string,
  participants: { profil_id: string; statut?: string }[],
) {
  return apiFetch<ParticipantReunion[]>(`/api/reunions/${id}/participants`, {
    method: 'PUT',
    body: JSON.stringify({ participants }),
  });
}

export function gererOrdreJour(
  id: string,
  points: {
    titre: string;
    description?: string | null;
    ordre?: number;
    duree_minutes?: number | null;
  }[],
) {
  return apiFetch<PointOrdreJour[]>(`/api/reunions/${id}/ordre-du-jour`, {
    method: 'PUT',
    body: JSON.stringify({ points }),
  });
}

export function listerDirections() {
  return apiFetch<Direction[]>('/api/directions');
}

export function listerProfils(params: { limite?: number; recherche?: string } = {}) {
  return apiFetch<PaginatedResult<Profil>>(
    `/api/profils${toQueryString({
      page: 1,
      limite: params.limite ?? 50,
      recherche: params.recherche,
    })}`,
  );
}

export function listerModeles() {
  return apiFetch<ModeleCompteRendu[]>('/api/modeles-compte-rendu');
}

export function cloturerReunion(id: string) {
  return apiFetch<Reunion>(`/api/reunions/${id}/cloturer`, { method: 'POST' });
}

export function modifierPointOrdreJour(
  reunionId: string,
  pointId: string,
  est_traite: boolean,
) {
  return apiFetch<PointOrdreJour>(
    `/api/reunions/${reunionId}/ordre-du-jour/${pointId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ est_traite }),
    },
  );
}

export function modifierParticipantStatut(
  reunionId: string,
  participantId: string,
  statut: string,
) {
  return apiFetch<ParticipantReunion>(
    `/api/reunions/${reunionId}/participants/${participantId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ statut }),
    },
  );
}

export function listerActionsReunion(reunionId: string) {
  return apiFetch<PaginatedResult<import('@ogefmeeting/shared').ActionSuivi>>(
    `/api/actions${toQueryString({ reunion_id: reunionId, limite: 50 })}`,
  );
}

export function listerComptesRendusReunion(reunionId: string) {
  return apiFetch<PaginatedResult<import('@ogefmeeting/shared').CompteRendu>>(
    `/api/comptes-rendus${toQueryString({ reunion_id: reunionId, limite: 20 })}`,
  );
}

export function creerCompteRendu(reunionId: string, cree_par?: string | null) {
  return apiFetch<import('@ogefmeeting/shared').CompteRendu>('/api/comptes-rendus', {
    method: 'POST',
    body: JSON.stringify({
      reunion_id: reunionId,
      contenu: {},
      cree_par: cree_par ?? null,
    }),
  });
}
