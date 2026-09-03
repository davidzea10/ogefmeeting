import type { PaginatedResult, Profil } from '@ogefmeeting/shared';
import { MOT_DE_PASSE_DEFAUT, TABLES } from '@ogefmeeting/shared';
import { env } from '../config/env.js';
import {
  requireSupabaseAdmin,
  requireSupabaseAuth,
} from '../lib/supabase.js';
import type {
  InviterUtilisateurInput,
  ListerAuditQuery,
  ModifierMonProfilInput,
  ModifierMotDePasseInput,
  MotDePasseOublieInput,
} from '../schemas/utilisateur.schemas.js';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { enregistrerAudit } from './audit.service.js';
import { envoyerEmailOgefmeeting } from './email.service.js';

export type JournalAudit = {
  id: string;
  profil_id: string | null;
  action: string;
  type_entite: string | null;
  entite_id: string | null;
  metadonnees: Record<string, unknown>;
  adresse_ip: string | null;
  cree_le: string;
};

export class UtilisateurService {
  async modifierMonProfil(userId: string, input: ModifierMonProfilInput): Promise<Profil> {
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.profils)
      .update(input)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier le profil.');
    }

    return data as Profil;
  }

  async inviter(input: InviterUtilisateurInput, invitePar?: string): Promise<{
    utilisateur: { id: string; email: string };
    profil: Profil;
    mot_de_passe_temporaire: string;
  }> {
    const admin = requireSupabaseAdmin();
    const motDePasse = input.password?.trim() || MOT_DE_PASSE_DEFAUT;

    const { data: created, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: motDePasse,
      email_confirm: true,
      user_metadata: {
        prenom: input.prenom,
        nom: input.nom,
        first_name: input.prenom,
        last_name: input.nom,
      },
    });

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!created.user) {
      throw new AppError(400, 'Invitation impossible.');
    }

    const { data: profil, error: profilError } = await admin
      .from(TABLES.profils)
      .update({
        prenom: input.prenom,
        nom: input.nom,
        role: input.role,
        direction_id: input.direction_id ?? null,
        fonction: input.fonction ?? null,
        matricule: input.matricule?.trim() || null,
        email: input.email,
        est_actif: true,
      })
      .eq('id', created.user.id)
      .select('*')
      .single();

    if (profilError) {
      handleSupabaseError(profilError, 'Utilisateur créé mais profil incomplet.');
    }

    await enregistrerAudit({
      action: 'utilisateur.invite',
      profil_id: invitePar ?? null,
      type_entite: 'profil',
      entite_id: created.user.id,
      metadonnees: {
        email: input.email,
        role: input.role,
        fonction: input.fonction ?? null,
        matricule: input.matricule ?? null,
      },
    });

    // Email de bienvenue (best-effort) avec identifiants
    await envoyerEmailOgefmeeting({
      to: input.email,
      subject: '[Ogefmeeting] Votre compte a été créé',
      titre: 'Bienvenue sur Ogefmeeting',
      message:
        `Un compte Ogefmeeting a été créé pour vous.\n\n` +
        `Email de connexion : ${input.email}\n` +
        `Mot de passe temporaire : ${motDePasse}\n\n` +
        `Connectez-vous puis changez votre mot de passe si possible.`,
      lien: `${env.FRONTEND_URL}/connexion`,
      boutonLibelle: 'Se connecter',
    });

    return {
      utilisateur: { id: created.user.id, email: input.email },
      profil: profil as Profil,
      mot_de_passe_temporaire: motDePasse,
    };
  }

  async modifierProfilAdmin(
    id: string,
    input: Record<string, unknown>,
    modifiePar?: string,
  ): Promise<Profil> {
    const supabase = requireSupabaseAdmin();
    const { email, ...profilPatch } = input as {
      email?: string;
    } & Record<string, unknown>;

    const emailNorm =
      typeof email === 'string' ? email.trim().toLowerCase() : undefined;

    if (emailNorm) {
      const { data: actuel } = await supabase
        .from(TABLES.profils)
        .select('email')
        .eq('id', id)
        .maybeSingle();

      const emailActuel = (actuel?.email as string | undefined)?.toLowerCase();
      if (emailActuel !== emailNorm) {
        const { data: collision } = await supabase
          .from(TABLES.profils)
          .select('id')
          .eq('email', emailNorm)
          .neq('id', id)
          .maybeSingle();

        if (collision) {
          throw new AppError(409, 'Cette adresse email est déjà utilisée par un autre compte.');
        }

        const { error: authError } = await supabase.auth.admin.updateUserById(id, {
          email: emailNorm,
          email_confirm: true,
        });

        if (authError) {
          const msg = authError.message?.toLowerCase() ?? '';
          if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
            throw new AppError(409, 'Cette adresse email est déjà utilisée.');
          }
          throw new AppError(
            400,
            authError.message || 'Impossible de mettre à jour l’email de connexion.',
          );
        }

        profilPatch.email = emailNorm;
      }
    }

    if (Object.keys(profilPatch).length === 0) {
      const { data: inchange, error: lectureError } = await supabase
        .from(TABLES.profils)
        .select('*')
        .eq('id', id)
        .single();
      if (lectureError) {
        handleSupabaseError(lectureError, 'Profil introuvable.');
      }
      return inchange as Profil;
    }

    const { data, error } = await supabase
      .from(TABLES.profils)
      .update(profilPatch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier le profil.');
    }

    await enregistrerAudit({
      action: 'profil.modifie_admin',
      profil_id: modifiePar ?? null,
      type_entite: 'profil',
      entite_id: id,
      metadonnees: {
        ...profilPatch,
        ...(emailNorm ? { email: emailNorm } : {}),
      },
    });

    return data as Profil;
  }

  async desactiverProfil(id: string, modifiePar?: string): Promise<Profil> {
    const admin = requireSupabaseAdmin();

    const { data, error } = await admin
      .from(TABLES.profils)
      .update({ est_actif: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de désactiver le profil.');
    }

    try {
      await admin.auth.admin.signOut(id);
    } catch {
      // Déconnexion forcée best-effort
    }

    await enregistrerAudit({
      action: 'profil.desactive',
      profil_id: modifiePar ?? null,
      type_entite: 'profil',
      entite_id: id,
    });

    return data as Profil;
  }

  async reactiverProfil(id: string, modifiePar?: string): Promise<Profil> {
    const admin = requireSupabaseAdmin();

    const { data, error } = await admin
      .from(TABLES.profils)
      .update({ est_actif: true })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de réactiver le profil.');
    }

    await enregistrerAudit({
      action: 'profil.reactive',
      profil_id: modifiePar ?? null,
      type_entite: 'profil',
      entite_id: id,
    });

    return data as Profil;
  }

  async changerMotDePasse(userId: string, input: ModifierMotDePasseInput): Promise<void> {
    const admin = requireSupabaseAdmin();

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: input.nouveau_mot_de_passe,
    });

    if (error) {
      throw new AppError(400, error.message);
    }
  }

  async motDePasseOublie(input: MotDePasseOublieInput): Promise<{ message: string }> {
    const authClient = requireSupabaseAuth();

    const { error } = await authClient.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${env.FRONTEND_URL}/reinitialiser-mot-de-passe`,
    });

    // Ne pas révéler si l'email existe
    if (error) {
      return {
        message:
          'Si cet email est enregistré, un lien de réinitialisation a été envoyé.',
      };
    }

    return {
      message: 'Si cet email est enregistré, un lien de réinitialisation a été envoyé.',
    };
  }

  async listerJournaux(query: ListerAuditQuery): Promise<PaginatedResult<JournalAudit>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, tri, ordre, profil_id, action } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let builder = supabase.from(TABLES.journauxAudit).select('*', { count: 'exact' });

    if (profil_id) builder = builder.eq('profil_id', profil_id);
    if (action) builder = builder.ilike('action', `%${action}%`);

    const { data, error, count } = await builder
      .order(tri, { ascending: ordre === 'asc' })
      .range(from, to);

    if (error) {
      handleSupabaseError(error, 'Impossible de charger le journal d’audit.');
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as JournalAudit[],
      pagination: {
        page,
        limite,
        total,
        total_pages: Math.max(1, Math.ceil(total / limite)),
      },
    };
  }
}

export const utilisateurService = new UtilisateurService();
