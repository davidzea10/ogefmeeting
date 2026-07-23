import type {
  ActionSuivi,
  Decision,
  PaginatedResult,
  PrioriteAction,
  StatutAction,
} from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function listerDecisions(params: {
  reunion_id?: string;
  compte_rendu_id?: string;
  page?: number;
  limite?: number;
} = {}) {
  return apiFetch<PaginatedResult<Decision>>(
    `/api/decisions${toQueryString(params)}`,
  );
}

export function creerDecision(payload: {
  reunion_id: string;
  titre: string;
  description?: string | null;
  compte_rendu_id?: string | null;
  decide_le?: string;
  cree_par?: string | null;
}) {
  return apiFetch<Decision>('/api/decisions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function supprimerDecision(id: string) {
  return apiFetch<{ id: string; supprime: boolean }>(`/api/decisions/${id}`, {
    method: 'DELETE',
  });
}

export function listerActions(params: {
  reunion_id?: string;
  compte_rendu_id?: string;
  responsable_id?: string;
  statut?: StatutAction;
  priorite?: PrioriteAction;
  page?: number;
  limite?: number;
} = {}) {
  return apiFetch<PaginatedResult<ActionSuivi>>(
    `/api/actions${toQueryString(params)}`,
  );
}

export function creerAction(payload: {
  reunion_id: string;
  titre: string;
  description?: string | null;
  responsable_id?: string | null;
  priorite?: PrioriteAction;
  statut?: StatutAction;
  date_echeance?: string | null;
  compte_rendu_id?: string | null;
  decision_id?: string | null;
  cree_par?: string | null;
}) {
  return apiFetch<ActionSuivi>('/api/actions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierAction(
  id: string,
  payload: {
    titre?: string;
    description?: string | null;
    responsable_id?: string | null;
    priorite?: PrioriteAction;
    statut?: StatutAction;
    date_echeance?: string | null;
    decision_id?: string | null;
  },
) {
  return apiFetch<ActionSuivi>(`/api/actions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function supprimerAction(id: string) {
  return apiFetch<{ id: string; supprime: boolean }>(`/api/actions/${id}`, {
    method: 'DELETE',
  });
}
