import type { ApiResponse } from '@ogefmeeting/shared';
import type { AuthSession } from '@/stores/auth.store';
import { useAuthStore } from '@/stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL ?? '';

type ApiError = { message: string; details?: unknown };

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

function getErrorMessage(payload: ApiResponse<unknown>, fallback: string): string {
  if (!payload.success) {
    return (payload.error as ApiError)?.message ?? fallback;
  }
  return fallback;
}

export async function apiConnexion(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseJson<AuthSession>(response);
  if (!payload.success) {
    throw new Error(getErrorMessage(payload, 'Email ou mot de passe incorrect.'));
  }
  return payload.data;
}

export async function apiRafraichir(refreshToken: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/rafraichir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await parseJson<AuthSession>(response);
  if (!payload.success) {
    throw new Error(getErrorMessage(payload, 'Session expirée. Reconnectez-vous.'));
  }
  return payload.data;
}

export async function apiDeconnexion(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  await fetch(`${API_URL}/api/auth/deconnexion`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => undefined);
}

export async function apiMotDePasseOublie(email: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/mot-de-passe/oublie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const payload = await parseJson<{ message: string }>(response);
  if (!payload.success) {
    throw new Error(getErrorMessage(payload, 'Impossible d’envoyer le lien.'));
  }
  return payload.data.message;
}

export async function apiChangerMotDePasse(
  accessToken: string,
  nouveauMotDePasse: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/mot-de-passe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nouveau_mot_de_passe: nouveauMotDePasse }),
  });
  const payload = await parseJson<{ message: string }>(response);
  if (!payload.success) {
    throw new Error(getErrorMessage(payload, 'Impossible de changer le mot de passe.'));
  }
}

/** Rafraîchit le token si proche de l'expiration (appelé au démarrage / navigation) */
export async function ensureFreshToken(): Promise<string | null> {
  const { accessToken, refreshToken, expiresAt, setSession, clearSession } =
    useAuthStore.getState();

  if (!accessToken || !refreshToken) return null;

  const bientôtExpiré = expiresAt !== null && Date.now() > expiresAt - 5 * 60_000;
  if (!bientôtExpiré) return accessToken;

  try {
    const session = await apiRafraichir(refreshToken);
    setSession(session);
    return session.access_token;
  } catch {
    clearSession();
    return null;
  }
}
