import type { DashboardResume } from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function obtenirDashboardResume(profil_id?: string | null) {
  return apiFetch<DashboardResume>(
    `/api/dashboard/resume${toQueryString({ profil_id: profil_id ?? undefined })}`,
  );
}
