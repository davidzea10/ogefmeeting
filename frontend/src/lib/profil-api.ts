import type { Profil } from '@ogefmeeting/shared';
import { apiFetch } from '@/lib/api-client';

export type MonProfilResponse = {
  authentifie: boolean;
  profil: Profil;
  permissions: string[];
};

export function obtenirMonProfil() {
  return apiFetch<MonProfilResponse>('/api/profil');
}

export function modifierMonProfil(payload: { prenom?: string; nom?: string }) {
  return apiFetch<Profil>('/api/profil', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
