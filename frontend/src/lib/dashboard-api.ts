import type { DashboardAdminStats, DashboardResume } from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function obtenirDashboardResume(profil_id?: string | null) {
  return apiFetch<DashboardResume>(
    `/api/dashboard/resume${toQueryString({ profil_id: profil_id ?? undefined })}`,
  );
}

export function obtenirDashboardAdmin() {
  return apiFetch<DashboardAdminStats>('/api/dashboard/admin');
}

/** Liens filtrés vers la liste des réunions depuis le tableau de bord. */
export function lienReunionsFiltrees(params: {
  statut?: string;
  direction_id?: string;
  date_debut?: string;
  date_fin?: string;
}): string {
  return `/reunions${toQueryString(params)}`;
}

/** Plage ISO du mois courant (YYYY-MM-DD pour les filtres UI). */
export function plageMoisCourant(): { date_debut: string; date_fin: string } {
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth(), 1);
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date_debut: fmt(debut), date_fin: fmt(fin) };
}
