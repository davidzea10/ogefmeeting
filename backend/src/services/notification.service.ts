import type { NotificationApp, PaginatedResult } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { logger } from '../lib/logger.js';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type { ListerNotificationsQuery } from '../schemas/parametres.schemas.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { isAppError } from '../utils/errors.js';
import { envoyerEmailOgefmeeting } from './email.service.js';

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
  /** Si fourni : envoie aussi un email */
  emailSujet?: string;
  emailBoutonLibelle?: string;
  /** Invitations réunion : true — Resend obligatoire */
  emailExigerReel?: boolean;
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

      for (const dest of list) {
        if (!dest.email) continue;
        await envoyerEmailOgefmeeting({
          to: dest.email,
          subject: payload.emailSujet,
          titre: payload.titre,
          message: payload.message,
          lien: payload.lien,
          boutonLibelle: payload.emailBoutonLibelle,
          exigerReel: payload.emailExigerReel,
        });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
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

  /**
   * Rappels de réunions planifiées :
   * - tous les jours tant que la date n’est pas atteinte ;
   * - le jour J : 2 h avant et 1 h avant.
   * Déclenché en best-effort (ex. compteur non-lues). Max 1 notif / type / destinataire.
   */
  async notifierRappelsReunions(): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const now = new Date();
    const jourCle = formatJourLocal(now);

    const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data: reunions, error } = await supabase
      .from(TABLES.reunions)
      .select('id, titre, date_prevue, lieu, cree_par, statut')
      .eq('statut', 'planifiee')
      .gte('date_prevue', now.toISOString())
      .lte('date_prevue', horizon.toISOString())
      .limit(80);

    if (error || !reunions?.length) return 0;

    let crees = 0;

    for (const reunion of reunions) {
      const datePrevue = new Date(reunion.date_prevue as string);
      if (Number.isNaN(datePrevue.getTime())) continue;

      const msRestant = datePrevue.getTime() - now.getTime();
      if (msRestant <= 0) continue;

      const joursRestants = calendrierJoursRestants(now, datePrevue);
      const dateLabel = datePrevue.toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const lieuPart = reunion.lieu ? ` — ${reunion.lieu}` : '';

      let type: string | null = null;
      let titre = '';
      let message = '';
      let metaCle: Record<string, unknown> = {};

      if (joursRestants >= 1) {
        type = 'rappel_reunion_quotidien';
        titre = 'Rappel de réunion';
        message =
          joursRestants === 1
            ? `La réunion « ${reunion.titre} » a lieu demain (${dateLabel})${lieuPart}.`
            : `La réunion « ${reunion.titre} » aura lieu dans ${joursRestants} jours (${dateLabel})${lieuPart}.`;
        metaCle = { reunion_id: reunion.id, jour: jourCle, kind: 'quotidien' };
      } else {
        // Jour J
        const deuxHeures = 2 * 60 * 60 * 1000;
        const uneHeure = 60 * 60 * 1000;
        if (msRestant <= deuxHeures && msRestant > uneHeure) {
          type = 'rappel_reunion_2h';
          titre = 'Réunion dans 2 heures';
          message = `La réunion « ${reunion.titre} » commence bientôt (${dateLabel})${lieuPart}.`;
          metaCle = { reunion_id: reunion.id, kind: '2h' };
        } else if (msRestant <= uneHeure) {
          type = 'rappel_reunion_1h';
          titre = 'Réunion dans 1 heure';
          message = `La réunion « ${reunion.titre} » commence dans moins d’une heure (${dateLabel})${lieuPart}.`;
          metaCle = { reunion_id: reunion.id, kind: '1h' };
        } else {
          // Matin du jour J (plus de 2 h avant) : rappel « aujourd’hui »
          type = 'rappel_reunion_quotidien';
          titre = 'Réunion aujourd’hui';
          message = `La réunion « ${reunion.titre} » a lieu aujourd’hui à ${dateLabel}${lieuPart}.`;
          metaCle = { reunion_id: reunion.id, jour: jourCle, kind: 'aujourdhui' };
        }
      }

      if (!type) continue;

      const destinataireIds = new Set<string>();
      if (reunion.cree_par) destinataireIds.add(reunion.cree_par as string);

      const { data: participants } = await supabase
        .from(TABLES.participantsReunion)
        .select('profil_id, statut')
        .eq('reunion_id', reunion.id)
        .in('statut', ['invite', 'confirme', 'present']);

      for (const p of participants ?? []) {
        if (p.profil_id) destinataireIds.add(p.profil_id as string);
      }

      if (destinataireIds.size === 0) continue;

      const ids = [...destinataireIds];
      const { data: profils } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom, est_actif')
        .in('id', ids)
        .eq('est_actif', true);

      const destinataires: DestinataireNotif[] = [];
      for (const profil of profils ?? []) {
        const { data: deja } = await supabase
          .from(TABLES.notifications)
          .select('id')
          .eq('profil_id', profil.id)
          .eq('type', type)
          .contains('metadonnees', metaCle)
          .maybeSingle();
        if (deja) continue;
        destinataires.push(profil as DestinataireNotif);
      }

      if (destinataires.length === 0) continue;

      await this.creerPourProfils(destinataires, {
        type,
        titre,
        message,
        lien: `/reunions/${reunion.id}`,
        emailSujet: `[Ogefmeeting] ${titre} — ${reunion.titre}`,
        emailBoutonLibelle: 'Voir la réunion',
        metadonnees: metaCle,
      });
      crees += destinataires.length;
    }

    return crees;
  }

  /**
   * Réunions planifiées dont l’heure prévue est dépassée (non démarrées).
   * Déclenché en best-effort (ex. compteur non-lues). Max 1 notif / type / réunion / destinataire.
   */
  async notifierReunionsHeureDepassee(): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const now = new Date();

    // On évite une boucle infinie sur des réunions trop anciennes.
    const fenetrePastMs = 6 * 60 * 60 * 1000;
    const debutFenetre = new Date(now.getTime() - fenetrePastMs);

    const { data: reunions, error } = await supabase
      .from(TABLES.reunions)
      .select('id, titre, date_prevue, lieu, cree_par, statut')
      .eq('statut', 'planifiee')
      .gte('date_prevue', debutFenetre.toISOString())
      .lte('date_prevue', now.toISOString())
      .limit(80);

    if (error || !reunions?.length) return 0;

    let crees = 0;

    for (const reunion of reunions) {
      const datePrevue = new Date(reunion.date_prevue as string);
      if (Number.isNaN(datePrevue.getTime())) continue;
      if (datePrevue.getTime() > now.getTime()) continue;

      const dateLabel = datePrevue.toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const lieuPart = reunion.lieu ? ` — ${reunion.lieu}` : '';

      const metaCle = {
        reunion_id: reunion.id,
        kind: 'heure_depassee',
        date_prevue: reunion.date_prevue,
      };

      const destinataireIds = new Set<string>();
      if (reunion.cree_par) destinataireIds.add(reunion.cree_par as string);

      const { data: participants } = await supabase
        .from(TABLES.participantsReunion)
        .select('profil_id, statut')
        .eq('reunion_id', reunion.id)
        .in('statut', ['invite', 'confirme', 'present']);

      for (const p of participants ?? []) {
        if (p.profil_id) destinataireIds.add(p.profil_id as string);
      }

      if (destinataireIds.size === 0) continue;

      const ids = [...destinataireIds];
      const { data: profils } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom, est_actif')
        .in('id', ids)
        .eq('est_actif', true);

      if (!profils?.length) continue;

      const organisateurId = reunion.cree_par as string | null;

      const organisateur = profils.find((p) => organisateurId && p.id === organisateurId);
      const autres = profils.filter((p) => !organisateurId || p.id !== organisateurId);

      // Organisateur : message orienté action
      if (organisateur) {
        const { data: deja } = await supabase
          .from(TABLES.notifications)
          .select('id')
          .eq('profil_id', organisateur.id)
          .eq('type', 'reunion_heure_depassee')
          .contains('metadonnees', metaCle)
          .maybeSingle();

        if (!deja) {
          await this.creerPourProfils([organisateur as DestinataireNotif], {
            type: 'reunion_heure_depassee',
            titre: 'Réunion en retard',
            message:
              `La réunion « ${reunion.titre} » devait commencer à ${dateLabel}${lieuPart}, ` +
              `mais l’heure est dépassée.\n\n` +
              `Lancez le live ou modifiez la date.`,
            lien: `/reunions/${reunion.id}`,
            emailSujet: `[Ogefmeeting] Réunion en retard — ${reunion.titre}`,
            emailBoutonLibelle: 'Voir la réunion',
            metadonnees: metaCle,
          });
          crees += 1;
        }
      }

      // Invités : message orienté attente
      const destinatairesInvites: DestinataireNotif[] = [];
      for (const profil of autres) {
        const { data: deja } = await supabase
          .from(TABLES.notifications)
          .select('id')
          .eq('profil_id', profil.id)
          .eq('type', 'reunion_heure_depassee')
          .contains('metadonnees', metaCle)
          .maybeSingle();
        if (!deja) destinatairesInvites.push(profil as DestinataireNotif);
      }

      if (destinatairesInvites.length > 0) {
        await this.creerPourProfils(destinatairesInvites, {
          type: 'reunion_heure_depassee',
          titre: 'Réunion en retard',
          message:
            `La réunion « ${reunion.titre} » devait commencer à ${dateLabel}${lieuPart}, ` +
            `mais l’heure est dépassée.\n\n` +
            `Attendez que l’organisateur lance le live.`,
          lien: `/reunions/${reunion.id}`,
          emailSujet: `[Ogefmeeting] Réunion en retard — ${reunion.titre}`,
          emailBoutonLibelle: 'Voir la réunion',
          metadonnees: metaCle,
        });
        crees += destinatairesInvites.length;
      }
    }

    return crees;
  }
}

export const notificationService = new NotificationService();

function formatJourLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nombre de jours calendaires restants (0 = jour J). */
function calendrierJoursRestants(now: Date, target: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
