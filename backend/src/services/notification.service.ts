import type { NotificationApp, PaginatedResult } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type { ListerNotificationsQuery } from '../schemas/parametres.schemas.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { envoyerEmail } from './email.service.js';

export type DestinataireNotif = {
  id: string;
  email?: string | null;
  prenom?: string;
  nom?: string;
};

export type CreerNotificationPayload = {
  type: string;
  titre: string;
  message: string;
  lien?: string | null;
  metadonnees?: Record<string, unknown>;
  /** Si fourni : envoie aussi un email (Resend / simulation) */
  emailSujet?: string;
};

export class NotificationService {
  async lister(
    profilId: string,
    query: ListerNotificationsQuery,
  ): Promise<PaginatedResult<NotificationApp>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, non_lues } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let builder = supabase
      .from(TABLES.notifications)
      .select('*', { count: 'exact' })
      .eq('profil_id', profilId);

    if (non_lues === true) builder = builder.eq('est_lu', false);

    const { data, error, count } = await builder
      .order('cree_le', { ascending: false })
      .range(from, to);

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les notifications.');
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as NotificationApp[],
      pagination: {
        page,
        limite,
        total,
        total_pages: Math.max(1, Math.ceil(total / limite)),
      },
    };
  }

  async compterNonLues(profilId: string): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const { count, error } = await supabase
      .from(TABLES.notifications)
      .select('*', { count: 'exact', head: true })
      .eq('profil_id', profilId)
      .eq('est_lu', false);

    if (error) {
      handleSupabaseError(error, 'Impossible de compter les notifications.');
    }

    return count ?? 0;
  }

  async marquerLue(profilId: string, id: string): Promise<NotificationApp> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.notifications)
      .update({ est_lu: true })
      .eq('id', id)
      .eq('profil_id', profilId)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de marquer la notification comme lue.');
    }

    return data as NotificationApp;
  }

  async marquerToutesLues(profilId: string): Promise<{ mises_a_jour: number }> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.notifications)
      .update({ est_lu: true })
      .eq('profil_id', profilId)
      .eq('est_lu', false)
      .select('id');

    if (error) {
      handleSupabaseError(error, 'Impossible de marquer les notifications comme lues.');
    }

    return { mises_a_jour: data?.length ?? 0 };
  }

  /**
   * Crée des notifications in-app (+ email optionnel). Best-effort.
   */
  async creerPourProfils(
    destinataires: DestinataireNotif[],
    payload: CreerNotificationPayload,
  ): Promise<void> {
    if (destinataires.length === 0) return;

    const uniques = new Map(destinataires.map((d) => [d.id, d]));
    const list = [...uniques.values()];

    try {
      const supabase = requireSupabaseAdmin();
      const rows = list.map((p) => ({
        profil_id: p.id,
        type: payload.type,
        titre: payload.titre,
        message: payload.message,
        lien: payload.lien ?? null,
        metadonnees: payload.metadonnees ?? {},
      }));

      const { error } = await supabase.from(TABLES.notifications).insert(rows);
      if (error) {
        logger.warn({ err: error }, 'Échec création notifications in-app');
      }

      if (!payload.emailSujet) return;

      const lienAbsolu = payload.lien?.startsWith('http')
        ? payload.lien
        : `${env.FRONTEND_URL}${payload.lien ?? ''}`;

      const html = `
        <p>${escapeHtml(payload.message)}</p>
        ${payload.lien ? `<p><a href="${lienAbsolu}">Ouvrir dans Ogefmeeting</a></p>` : ''}
        <p style="color:#666;font-size:12px;">Ogefmeeting — OGEFREM</p>
      `;

      for (const dest of list) {
        if (!dest.email) continue;
        await envoyerEmail({
          to: dest.email,
          subject: payload.emailSujet,
          html,
          text: `${payload.message}\n\n${lienAbsolu}`,
        });
      }
    } catch (error) {
      logger.warn({ err: error }, 'Échec notification');
    }
  }

  /** Signale les actions en retard au responsable (une notif / action / jour max via métadonnées). */
  async notifierActionsEnRetard(): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const aujourdHui = new Date().toISOString().slice(0, 10);

    const { data: actions, error } = await supabase
      .from(TABLES.actions)
      .select('id, titre, responsable_id, reunion_id, date_echeance')
      .in('statut', ['en_attente', 'en_cours', 'en_retard'])
      .not('responsable_id', 'is', null)
      .not('date_echeance', 'is', null)
      .lt('date_echeance', aujourdHui)
      .limit(100);

    if (error || !actions?.length) return 0;

    let crees = 0;
    for (const action of actions) {
      const responsableId = action.responsable_id as string;
      const { data: deja } = await supabase
        .from(TABLES.notifications)
        .select('id')
        .eq('profil_id', responsableId)
        .eq('type', 'action_en_retard')
        .contains('metadonnees', { action_id: action.id, jour: aujourdHui })
        .maybeSingle();

      if (deja) continue;

      const { data: profil } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom')
        .eq('id', responsableId)
        .maybeSingle();

      if (!profil) continue;

      await this.creerPourProfils([profil as DestinataireNotif], {
        type: 'action_en_retard',
        titre: 'Action en retard',
        message: `L’action « ${action.titre} » a dépassé son échéance.`,
        lien: `/actions`,
        emailSujet: `[Ogefmeeting] Action en retard — ${action.titre}`,
        metadonnees: {
          action_id: action.id,
          reunion_id: action.reunion_id,
          jour: aujourdHui,
        },
      });
      crees += 1;
    }

    return crees;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const notificationService = new NotificationService();
