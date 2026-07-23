import type {
  JournalAudit,
  NotificationApp,
  PaginatedResult,
  ParametresApplication,
} from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function obtenirParametres() {
  return apiFetch<ParametresApplication>('/api/parametres');
}

export function modifierParametres(payload: {
  logo_url?: string | null;
  en_tete_pdf?: string;
  sous_titre_pdf?: string;
  duree_retention_jours?: number;
}) {
  return apiFetch<ParametresApplication>('/api/parametres', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listerAudit(params: {
  page?: number;
  limite?: number;
  action?: string;
  profil_id?: string;
} = {}) {
  return apiFetch<PaginatedResult<JournalAudit>>(
    `/api/audit${toQueryString(params)}`,
  );
}

export function listerNotifications(params: {
  page?: number;
  limite?: number;
  non_lues?: boolean;
} = {}) {
  return apiFetch<PaginatedResult<NotificationApp>>(
    `/api/notifications${toQueryString({
      ...params,
      non_lues:
        params.non_lues === undefined
          ? undefined
          : params.non_lues
            ? 'true'
            : 'false',
    })}`,
  );
}

export function compterNotificationsNonLues() {
  return apiFetch<{ non_lues: number }>('/api/notifications/non-lues');
}

export function marquerNotificationLue(id: string) {
  return apiFetch<NotificationApp>(`/api/notifications/${id}/lire`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function marquerToutesNotificationsLues() {
  return apiFetch<{ mises_a_jour: number }>('/api/notifications/lire-toutes', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
