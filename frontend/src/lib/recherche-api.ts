import type { ResultatRecherche } from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

export function rechercher(q: string, limite = 10) {
  return apiFetch<ResultatRecherche>(
    `/api/recherche${toQueryString({ q, limite })}`,
  );
}
