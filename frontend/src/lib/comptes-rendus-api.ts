import type {
  CompteRendu,
  ModeleCompteRendu,
  PaginatedResult,
  VersionCompteRendu,
} from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function listerComptesRendus(params: {
  reunion_id?: string;
  statut?: string;
  page?: number;
  limite?: number;
} = {}) {
  return apiFetch<PaginatedResult<CompteRendu>>(
    `/api/comptes-rendus${toQueryString(params)}`,
  );
}

export function obtenirCompteRendu(id: string) {
  return apiFetch<CompteRendu>(`/api/comptes-rendus/${id}`);
}

export function creerCompteRendu(payload: {
  reunion_id: string;
  contenu?: Record<string, unknown>;
  contenu_html?: string | null;
  cree_par?: string | null;
}) {
  return apiFetch<CompteRendu>('/api/comptes-rendus', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierCompteRendu(
  id: string,
  payload: {
    contenu?: Record<string, unknown>;
    contenu_html?: string | null;
    modifie_par?: string | null;
    historiser?: boolean;
  },
) {
  return apiFetch<CompteRendu>(`/api/comptes-rendus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listerVersionsCompteRendu(id: string) {
  return apiFetch<VersionCompteRendu[]>(`/api/comptes-rendus/${id}/versions`);
}

export function listerModelesCompteRendu() {
  return apiFetch<ModeleCompteRendu[]>('/api/modeles-compte-rendu');
}
