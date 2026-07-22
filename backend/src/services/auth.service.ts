import type { Profil } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { logger } from '../lib/logger.js';
import {
  getSupabaseAdmin,
  requireSupabaseAdmin,
  requireSupabaseAuth,
} from '../lib/supabase.js';
import type {
  ConnexionInput,
  InscriptionInput,
  RafraichirInput,
} from '../schemas/auth.schemas.js';
import { AppError } from '../utils/errors.js';

export type SessionAuth = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
  };
  profil: Profil | null;
};

export class AuthService {
  async inscription(input: InscriptionInput): Promise<SessionAuth> {
    const admin = getSupabaseAdmin();
    const authClient = requireSupabaseAuth();

    // Préférer admin.createUser avec email déjà confirmé → aucun blocage "confirmez votre email"
    if (admin) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          prenom: input.prenom,
          nom: input.nom,
          first_name: input.prenom,
          last_name: input.nom,
        },
      });

      if (createError) {
        throw new AppError(400, createError.message);
      }

      if (!created.user) {
        throw new AppError(400, 'Inscription impossible.');
      }

      await admin
        .from(TABLES.profils)
        .update({
          prenom: input.prenom,
          nom: input.nom,
          role: input.role,
          direction_id: input.direction_id ?? null,
          fonction: input.fonction ?? null,
          email: input.email,
        })
        .eq('id', created.user.id);

      // Ouvrir une session immédiatement
      return this.connexion({ email: input.email, password: input.password });
    }

    // Fallback sans service_role : signUp classique (peut exiger confirmation email selon config Supabase)
    const { data, error } = await authClient.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          prenom: input.prenom,
          nom: input.nom,
          first_name: input.prenom,
          last_name: input.nom,
        },
      },
    });

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data.user) {
      throw new AppError(400, 'Inscription impossible.');
    }

    if (!data.session) {
      return {
        access_token: '',
        refresh_token: '',
        expires_in: 0,
        token_type: 'bearer',
        user: { id: data.user.id, email: input.email },
        profil: await this.chargerProfil(data.user.id),
      };
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
      token_type: data.session.token_type ?? 'bearer',
      user: { id: data.user.id, email: input.email },
      profil: await this.chargerProfil(data.user.id),
    };
  }

  async connexion(input: ConnexionInput): Promise<SessionAuth> {
    const authClient = requireSupabaseAuth();

    let data;
    let error;
    try {
      ({ data, error } = await authClient.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur Auth Supabase';
      throw new AppError(503, `Connexion Auth impossible : ${message}`);
    }

    if (error) {
      throw new AppError(401, 'Email ou mot de passe incorrect.');
    }

    if (!data.session || !data.user) {
      throw new AppError(401, 'Connexion impossible.');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
      token_type: data.session.token_type ?? 'bearer',
      user: { id: data.user.id, email: data.user.email ?? input.email },
      profil: await this.chargerProfil(data.user.id),
    };
  }

  async rafraichir(input: RafraichirInput): Promise<SessionAuth> {
    const authClient = requireSupabaseAuth();

    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: input.refresh_token,
    });

    if (error || !data.session || !data.user) {
      throw new AppError(401, 'Session expirée. Reconnectez-vous.');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
      token_type: data.session.token_type ?? 'bearer',
      user: { id: data.user.id, email: data.user.email ?? '' },
      profil: await this.chargerProfil(data.user.id),
    };
  }

  async moi(userId: string): Promise<Profil> {
    const profil = await this.chargerProfil(userId);
    if (!profil) {
      throw new AppError(404, 'Profil introuvable.');
    }
    return profil;
  }

  async deconnexion(accessToken?: string): Promise<void> {
    if (!accessToken) return;

    const admin = getSupabaseAdmin();
    if (!admin) return;

    try {
      await admin.auth.admin.signOut(accessToken);
    } catch (error) {
      logger.debug({ err: error }, 'Déconnexion — ignorée (non bloquant)');
    }
  }

  private async chargerProfil(userId: string): Promise<Profil | null> {
    try {
      const supabase = requireSupabaseAdmin();
      const { data, error } = await supabase
        .from(TABLES.profils)
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data as Profil | null;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
