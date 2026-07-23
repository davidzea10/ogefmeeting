import type {
  CompteRendu,
  ModeleCompteRendu,
  PaginatedResult,
  VersionCompteRendu,
} from '@ogefmeeting/shared';
import { apiFetch, ApiClientError, toQueryString } from '@/lib/api-client';
import { ensureFreshToken } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? '';

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

export function soumettreCompteRendu(
  id: string,
  payload: { commentaire?: string | null; auteur_id?: string | null } = {},
) {
  return apiFetch<CompteRendu>(`/api/comptes-rendus/${id}/soumettre`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function validerCompteRendu(
  id: string,
  payload: { valide_par?: string | null; commentaire?: string | null } = {},
) {
  return apiFetch<CompteRendu>(`/api/comptes-rendus/${id}/valider`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function rejeterCompteRendu(
  id: string,
  payload: { commentaire: string; auteur_id?: string | null },
) {
  return apiFetch<CompteRendu>(`/api/comptes-rendus/${id}/rejeter`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function archiverCompteRendu(id: string) {
  return apiFetch<CompteRendu>(`/api/comptes-rendus/${id}/archiver`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function listerCommentairesCompteRendu(id: string) {
  return apiFetch<import('@ogefmeeting/shared').CommentaireCompteRendu[]>(
    `/api/comptes-rendus/${id}/commentaires`,
  );
}

export function ajouterCommentaireCompteRendu(
  id: string,
  payload: { contenu: string; type?: string; auteur_id?: string | null },
) {
  return apiFetch<import('@ogefmeeting/shared').CommentaireCompteRendu>(
    `/api/comptes-rendus/${id}/commentaires`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function listerModelesCompteRendu() {
  return apiFetch<ModeleCompteRendu[]>('/api/modeles-compte-rendu');
}

/** Télécharge le PDF binaire du compte rendu (blob, pas JSON). */
export async function telechargerPdfCompteRendu(id: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const token = (await ensureFreshToken()) ?? useAuthStore.getState().accessToken;
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}/api/comptes-rendus/${id}/export/pdf`, {
    headers,
  });

  if (!response.ok) {
    let message = `Erreur HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload?.error?.message) message = payload.error.message;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(message, response.status);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `compte-rendu-${id}.pdf`;
  const blob = await response.blob();
  return { blob, filename };
}
