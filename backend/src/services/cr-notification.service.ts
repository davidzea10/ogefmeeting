import type { CompteRendu } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { envoyerEmailOgefmeeting } from './email.service.js';
import {
  notificationService,
  type DestinataireNotif,
} from './notification.service.js';

type ProfilDestinataire = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  est_actif?: boolean;
};

async function titreReunion(reunionId: string): Promise<string> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLES.reunions)
    .select('titre')
    .eq('id', reunionId)
    .maybeSingle();
  return (data as { titre?: string } | null)?.titre ?? 'Réunion';
}

async function profilParId(id: string | null | undefined): Promise<ProfilDestinataire | null> {
  if (!id) return null;
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLES.profils)
    .select('id, email, prenom, nom')
    .eq('id', id)
    .eq('est_actif', true)
    .maybeSingle();
  return (data as ProfilDestinataire | null) ?? null;
}

async function profilsParRoles(roles: string[]): Promise<ProfilDestinataire[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLES.profils)
    .select('id, email, prenom, nom')
    .in('role', roles)
    .eq('est_actif', true);
  return (data ?? []) as ProfilDestinataire[];
}

function lienCr(crId: string): string {
  return `${env.FRONTEND_URL}/comptes-rendus/${crId}`;
}

async function notifierInApp(
  destinataires: ProfilDestinataire[],
  payload: {
    type: string;
    titre: string;
    message: string;
    lien: string;
    metadonnees?: Record<string, unknown>;
  },
): Promise<void> {
  if (destinataires.length === 0) return;
  const supabase = requireSupabaseAdmin();
  const rows = destinataires.map((p) => ({
    profil_id: p.id,
    type: payload.type,
    titre: payload.titre,
    message: payload.message,
    lien: payload.lien,
    metadonnees: payload.metadonnees ?? {},
  }));
  const { error } = await supabase.from(TABLES.notifications).insert(rows);
  if (error) {
    logger.warn({ err: error }, 'Impossible de créer les notifications in-app CR');
  }
}

/**
 * Notifie les acteurs concernés d’un changement de statut CR (in-app + email).
 * Best-effort : n’interrompt jamais le workflow.
 */
export async function notifierChangementStatutCr(opts: {
  cr: CompteRendu;
  ancienStatut: string;
  nouveauStatut: string;
  commentaire?: string | null;
}): Promise<void> {
  try {
    const titre = await titreReunion(opts.cr.reunion_id);
    const lien = lienCr(opts.cr.id);
    const motif = opts.commentaire?.trim();

    let destinataires: ProfilDestinataire[] = [];
    let sujet = '';
    let message = '';

    if (opts.nouveauStatut === 'soumis') {
      destinataires = await profilsParRoles(['directeur', 'administrateur']);
      sujet = `[Ogefmeeting] Compte rendu soumis — ${titre}`;
      message = `Un compte rendu pour « ${titre} » a été soumis et attend votre validation.`;
    } else if (opts.nouveauStatut === 'en_revision') {
      const auteur = await profilParId(opts.cr.cree_par);
      destinataires = auteur ? [auteur] : [];
      sujet = `[Ogefmeeting] Compte rendu à corriger — ${titre}`;
      message = `Votre compte rendu pour « ${titre} » a été renvoyé en révision.${
        motif ? ` Motif : ${motif}` : ''
      }`;
    } else if (opts.nouveauStatut === 'valide') {
      const auteur = await profilParId(opts.cr.cree_par);
      destinataires = auteur ? [auteur] : [];
      sujet = `[Ogefmeeting] Compte rendu publié — ${titre}`;
      message = `Le compte rendu pour « ${titre} » a été validé et publié.${
        motif ? ` Commentaire : ${motif}` : ''
      }`;

      const { data: participantRows } = await requireSupabaseAdmin()
        .from(TABLES.participantsReunion)
        .select('profils(id, email, prenom, nom, est_actif)')
        .eq('reunion_id', opts.cr.reunion_id);

      for (const row of participantRows ?? []) {
        const raw = (row as { profils?: ProfilDestinataire | ProfilDestinataire[] | null })
          .profils;
        const profil = Array.isArray(raw) ? raw[0] : raw;
        if (profil?.id && profil.est_actif !== false) {
          destinataires.push(profil);
        }
      }
    } else if (opts.nouveauStatut === 'archive') {
      const auteur = await profilParId(opts.cr.cree_par);
      destinataires = auteur ? [auteur] : [];
      sujet = `[Ogefmeeting] Compte rendu archivé — ${titre}`;
      message = `Le compte rendu pour « ${titre} » a été archivé.`;
    } else {
      return;
    }

    // Dédupliquer
    const uniques = new Map(destinataires.map((d) => [d.id, d]));
    destinataires = [...uniques.values()];

    await notifierInApp(destinataires, {
      type:
        opts.nouveauStatut === 'valide'
          ? 'cr_publie'
          : opts.nouveauStatut === 'soumis'
            ? 'cr_a_valider'
            : `cr_${opts.nouveauStatut}`,
      titre: sujet.replace('[Ogefmeeting] ', ''),
      message,
      lien,
      metadonnees: {
        compte_rendu_id: opts.cr.id,
        reunion_id: opts.cr.reunion_id,
        ancien_statut: opts.ancienStatut,
        nouveau_statut: opts.nouveauStatut,
      },
    });

    for (const dest of destinataires) {
      if (!dest.email) continue;
      await envoyerEmailOgefmeeting({
        to: dest.email,
        subject: sujet,
        titre: sujet.replace('[Ogefmeeting] ', ''),
        message: motif ? `${message}\n\nCommentaire : ${motif}` : message,
        lien,
        boutonLibelle: 'Ouvrir le compte rendu',
      });
    }
  } catch (error) {
    logger.warn({ err: error }, 'Échec notification changement statut CR');
  }
}

/**
 * Notifie tous les participants lorsqu’un compte rendu est créé pour une réunion clôturée.
 * Best-effort : n’interrompt jamais la création du CR.
 */
export async function notifierParticipantsRapportReunion(opts: {
  cr: CompteRendu;
}): Promise<void> {
  try {
    const supabase = requireSupabaseAdmin();

    const { data: reunion } = await supabase
      .from(TABLES.reunions)
      .select('titre, statut')
      .eq('id', opts.cr.reunion_id)
      .maybeSingle();

    if (!reunion || (reunion as { statut: string }).statut !== 'cloturee') {
      return;
    }

    const { count } = await supabase
      .from(TABLES.comptesRendus)
      .select('id', { count: 'exact', head: true })
      .eq('reunion_id', opts.cr.reunion_id);

    if ((count ?? 0) > 1) {
      return;
    }

    const { data: rows } = await supabase
      .from(TABLES.participantsReunion)
      .select('profil_id, profils(id, email, prenom, nom, est_actif)')
      .eq('reunion_id', opts.cr.reunion_id);

    const destinataires: DestinataireNotif[] = [];
    for (const row of rows ?? []) {
      const raw = (row as { profils?: ProfilDestinataire | ProfilDestinataire[] | null })
        .profils;
      const profil = Array.isArray(raw) ? raw[0] : raw;
      if (profil?.id && profil.est_actif !== false) {
        destinataires.push({
          id: profil.id,
          email: profil.email,
          prenom: profil.prenom,
          nom: profil.nom,
        });
      }
    }

    if (destinataires.length === 0) return;

    const titreReunion = (reunion as { titre?: string }).titre ?? 'Réunion';
    const lien = lienCr(opts.cr.id);
    const titreNotif = `Compte rendu — ${titreReunion}`;
    const message =
      `La réunion « ${titreReunion} » est clôturée. ` +
      `Le compte rendu est disponible au téléchargement (PDF).`;

    await notificationService.creerPourProfils(destinataires, {
      type: 'cr_disponible',
      titre: titreNotif,
      message,
      lien,
      emailSujet: `[Ogefmeeting] Compte rendu disponible — ${titreReunion}`,
      emailBoutonLibelle: 'Télécharger le compte rendu',
      metadonnees: {
        compte_rendu_id: opts.cr.id,
        reunion_id: opts.cr.reunion_id,
      },
    });
  } catch (error) {
    logger.warn({ err: error }, 'Échec notification participants compte rendu');
  }
}
