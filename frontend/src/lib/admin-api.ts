import type {
  Direction,
  FonctionOrganisation,
  ModeleCompteRendu,
  PaginatedResult,
  Profil,
  RoleUtilisateur,
  SectionCompteRendu,
} from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function listerProfilsAdmin(params: {
  page?: number;
  limite?: number;
  role?: RoleUtilisateur;
  direction_id?: string;
  est_actif?: boolean;
  recherche?: string;
} = {}) {
  return apiFetch<PaginatedResult<Profil>>(
    `/api/profils${toQueryString({
      ...params,
      est_actif:
        params.est_actif === undefined ? undefined : params.est_actif ? 'true' : 'false',
    })}`,
  );
}

export function creerMembre(payload: {
  email: string;
  prenom?: string;
  nom?: string;
  role?: RoleUtilisateur;
  direction_id?: string | null;
  fonction?: FonctionOrganisation | null;
  matricule?: string | null;
  password?: string;
}) {
  return apiFetch<{
    utilisateur: { id: string; email: string };
    profil: Profil;
    mot_de_passe_temporaire: string;
  }>('/api/utilisateurs/inviter', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierMembre(
  id: string,
  payload: {
    email?: string;
    prenom?: string;
    nom?: string;
    direction_id?: string | null;
    fonction?: FonctionOrganisation | null;
    matricule?: string | null;
    role?: RoleUtilisateur;
    est_actif?: boolean;
  },
) {
  return apiFetch<Profil>(`/api/utilisateurs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function desactiverMembre(id: string) {
  return apiFetch<Profil>(`/api/utilisateurs/${id}/desactiver`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function reactiverMembre(id: string) {
  return apiFetch<Profil>(`/api/utilisateurs/${id}/reactiver`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function listerDirectionsAdmin() {
  return apiFetch<Direction[]>('/api/directions');
}

export function creerDirection(payload: {
  nom: string;
  code?: string | null;
  description?: string | null;
}) {
  return apiFetch<Direction>('/api/directions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierDirection(
  id: string,
  payload: { nom?: string; code?: string | null; description?: string | null },
) {
  return apiFetch<Direction>(`/api/directions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listerModelesAdmin() {
  return apiFetch<ModeleCompteRendu[]>('/api/modeles-compte-rendu');
}

export function creerModele(payload: {
  nom: string;
  identifiant: string;
  description?: string | null;
  sections?: SectionCompteRendu[];
  est_par_defaut?: boolean;
}) {
  return apiFetch<ModeleCompteRendu>('/api/modeles-compte-rendu', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function modifierModele(
  id: string,
  payload: {
    nom?: string;
    description?: string | null;
    sections?: SectionCompteRendu[];
    est_par_defaut?: boolean;
  },
) {
  return apiFetch<ModeleCompteRendu>(`/api/modeles-compte-rendu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Nettoyage admin (avant lancement) */
export type ReunionNettoyageItem = {
  id: string;
  titre: string;
  statut: string;
  date_prevue: string;
  cree_le: string;
  est_test_live: boolean;
};

export function obtenirResumeNettoyage() {
  return apiFetch<{
    notifications: number;
    reunions: ReunionNettoyageItem[];
    reunions_test_live: number;
  }>('/api/admin/nettoyage');
}

export function purgerNotificationsAdmin() {
  return apiFetch<{ supprimees: number }>('/api/admin/nettoyage/notifications/purger', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function purgerReunionsTestLiveAdmin() {
  return apiFetch<{ supprimees: number; titres: string[] }>(
    '/api/admin/nettoyage/reunions-test-live/purger',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export function supprimerReunionDefinitiveAdmin(id: string) {
  return apiFetch<{ id: string; titre: string }>(`/api/admin/nettoyage/reunions/${id}`, {
    method: 'DELETE',
  });
}

export type CrParticulierMeta = {
  id: string;
  titre: string;
  type_reunion: string;
  lieu: string;
  date_reunion: string;
  directions_codes: string[];
  description: string;
  participants: string[];
  points_ordre_jour: string[];
  transcription_apercu: string;
  nb_mots_transcription: number;
  transcription_complete: boolean;
};

export type CrParticulierStats = {
  mots_introduction: number;
  mots_conclusion: number;
  mots_total: number;
  points: Array<{
    titre: string;
    romain: string;
    mots_contenu: number;
    sous_points: Array<{ titre: string; mots: number }>;
  }>;
};

export type CrParticulierPreview = {
  meta: Omit<
    CrParticulierMeta,
    'transcription_apercu' | 'nb_mots_transcription' | 'transcription_complete'
  >;
  brouillon: {
    niveau_detail: string;
    directions_impliquees: string[];
    introduction: string;
    points_ordre_jour: Array<{
      titre: string;
      contenu: string;
      sous_points: Array<{ titre: string; contenu: string }>;
    }>;
    conclusion: string;
  };
  contenu: Record<string, string>;
  contenu_html: string;
  nb_mots_transcription: number;
  stats?: CrParticulierStats;
};

export function obtenirMetaCrParticulier() {
  return apiFetch<CrParticulierMeta>('/api/admin/cr-particulier');
}

export function genererCrParticulier() {
  return apiFetch<CrParticulierPreview>('/api/admin/cr-particulier/generer', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function telechargerPdfCrParticulier(payload: {
  contenu: Record<string, string>;
  contenu_html: string;
}): Promise<Blob> {
  const { ensureFreshToken } = await import('@/lib/auth-api');
  const { useAuthStore } = await import('@/stores/auth.store');
  const API_URL = import.meta.env.VITE_API_URL ?? '';
  const token =
    (await ensureFreshToken()) ?? useAuthStore.getState().accessToken;
  const response = await fetch(`${API_URL}/api/admin/cr-particulier/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = `Erreur HTTP ${response.status}`;
    try {
      const j = (await response.json()) as { error?: { message?: string } };
      if (j.error?.message) message = j.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return response.blob();
}

