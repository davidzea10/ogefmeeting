import type { Profil, RoleUtilisateur } from '@ogefmeeting/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email: string };
  profil: Profil | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string } | null;
  profil: Profil | null;
  role: RoleUtilisateur | null;
  expiresAt: number | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      profil: null,
      role: null,
      expiresAt: null,

      setSession: (session) =>
        set({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          user: session.user,
          profil: session.profil,
          role: session.profil?.role ?? null,
          expiresAt: Date.now() + session.expires_in * 1000,
        }),

      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          profil: null,
          role: null,
          expiresAt: null,
        }),

      isAuthenticated: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken) return false;
        if (expiresAt && Date.now() > expiresAt + 60_000) return false;
        return true;
      },
    }),
    { name: 'ogefmeeting-auth' },
  ),
);
