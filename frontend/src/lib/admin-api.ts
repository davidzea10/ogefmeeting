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
