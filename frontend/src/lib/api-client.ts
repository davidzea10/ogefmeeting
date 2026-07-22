import type { ApiResponse } from '@ogefmeeting/shared';
import { ensureFreshToken } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? '';

type ApiError = { message: string };

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

function getErrorMessage(payload: ApiResponse<unknown>, fallback: string): string {
  if (!payload.success) {
    return (payload.error as ApiError)?.message ?? fallback;
  }
  return fallback;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = (await ensureFreshToken()) ?? useAuthStore.getState().accessToken;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new ApiClientError(
      getErrorMessage(payload, `Erreur HTTP ${response.status}`),
      response.status,
    );
  }

  return payload.data;
}

export function toQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
