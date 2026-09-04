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
 * Notifie les acteurs concernés d’un changement de statut CR (in-app uniquement).
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
      sujet = `[Ogefmeeting] Compte rendu validé — ${titre}`;
      message = `Le compte rendu pour « ${titre} » a été validé.${
        motif ? ` Commentaire : ${motif}` : ''
      } L’envoi du rapport PDF aux participants est déclenché si la réunion est clôturée.`;
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
    // Pas d’email externe ici : seuls invitation, démarrage live et envoi du CR (PDF) partent en boîte.
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
      // In-app seulement — l’email CR part lors de l’envoi officiel du PDF aux participants
      metadonnees: {
        compte_rendu_id: opts.cr.id,
        reunion_id: opts.cr.reunion_id,
      },
    });
  } catch (error) {
    logger.warn({ err: error }, 'Échec notification participants compte rendu');
  }
}

export type ResultatEnvoiRapportParticipants = {
  envoye: boolean;
  nb_destinataires: number;
  nb_emails_ok: number;
  motif_non_envoi?: string;
};

/**
 * Envoie le rapport PDF validé à tous les participants.
 * Prérequis : CR validé + réunion clôturée.
 */
export async function envoyerRapportAuxParticipants(opts: {
  cr: CompteRendu;
  /** Si true : lève une AppError si les prérequis ne sont pas remplis. */
  exigerConditions?: boolean;
}): Promise<ResultatEnvoiRapportParticipants> {
  const { AppError } = await import('../utils/errors.js');
  const { compteRenduService } = await import('./compte-rendu.service.js');

  const supabase = requireSupabaseAdmin();
  const { data: reunion, error: reunionError } = await supabase
    .from(TABLES.reunions)
    .select('id, titre, statut, cree_par')
    .eq('id', opts.cr.reunion_id)
    .maybeSingle();

  if (reunionError) {
    logger.warn({ err: reunionError }, 'Impossible de charger la réunion pour envoi CR');
  }

  const statutReunion = (reunion as { statut?: string } | null)?.statut;
  const titre = (reunion as { titre?: string } | null)?.titre ?? 'Réunion';

  if (opts.cr.statut !== 'valide' && opts.cr.statut !== 'archive') {
    if (opts.exigerConditions) {
      throw new AppError(
        400,
        'Le compte rendu doit être validé avant envoi aux participants.',
      );
    }
    return {
      envoye: false,
      nb_destinataires: 0,
      nb_emails_ok: 0,
      motif_non_envoi: 'Compte rendu non validé',
    };
  }

  if (statutReunion !== 'cloturee') {
    if (opts.exigerConditions) {
      throw new AppError(
        400,
        'La réunion doit être clôturée avant envoi du rapport aux participants.',
      );
    }
    return {
      envoye: false,
      nb_destinataires: 0,
      nb_emails_ok: 0,
      motif_non_envoi: 'Réunion non clôturée',
    };
  }

  const { data: rows } = await supabase
    .from(TABLES.participantsReunion)
    .select('profils(id, email, prenom, nom, est_actif)')
    .eq('reunion_id', opts.cr.reunion_id);

  const destinataires: ProfilDestinataire[] = [];
  for (const row of rows ?? []) {
    const raw = (row as { profils?: ProfilDestinataire | ProfilDestinataire[] | null }).profils;
    const profil = Array.isArray(raw) ? raw[0] : raw;
    if (profil?.id && profil.est_actif !== false && profil.email) {
      destinataires.push(profil);
    }
  }

  // Dédupliquer
  const uniques = [...new Map(destinataires.map((d) => [d.id, d])).values()];

  if (uniques.length === 0) {
    if (opts.exigerConditions) {
      throw new AppError(400, 'Aucun participant avec email pour cette réunion.');
    }
    return {
      envoye: false,
      nb_destinataires: 0,
      nb_emails_ok: 0,
      motif_non_envoi: 'Aucun destinataire',
    };
  }

  let pdfBuffer: Buffer;
  let filename: string;
  try {
    const pdf = await compteRenduService.exporterPdf(opts.cr.id);
    pdfBuffer = pdf.buffer;
    filename = pdf.filename;
  } catch (error) {
    logger.warn({ err: error }, 'Impossible de générer le PDF pour envoi participants');
    if (opts.exigerConditions) {
      throw new AppError(502, 'Impossible de générer le PDF du compte rendu.');
    }
    return {
      envoye: false,
      nb_destinataires: uniques.length,
      nb_emails_ok: 0,
      motif_non_envoi: 'Échec génération PDF',
    };
  }

  const lien = lienCr(opts.cr.id);
  const sujet = `[Ogefmeeting] Rapport de réunion — ${titre}`;
  const message =
    `Bonjour,\n\n` +
    `La réunion « ${titre} » est clôturée et son compte rendu a été validé.\n` +
    `Vous trouverez ci-joint le rapport PDF officiel.\n\n` +
    `Vous pouvez également le consulter dans Ogefmeeting.`;

  const attachment = {
    filename,
    content: pdfBuffer.toString('base64'),
    contentType: 'application/pdf',
  };

  await notifierInApp(uniques, {
    type: 'cr_envoye_participants',
    titre: `Rapport envoyé — ${titre}`,
    message: `Le compte rendu validé de la réunion « ${titre} » vous a été transmis par email (PDF).`,
    lien,
    metadonnees: {
      compte_rendu_id: opts.cr.id,
      reunion_id: opts.cr.reunion_id,
    },
  });

  let nbOk = 0;
  for (const dest of uniques) {
    const result = await envoyerEmailOgefmeeting({
      to: dest.email,
      subject: sujet,
      titre: `Rapport de réunion — ${titre}`,
      message,
      lien,
      boutonLibelle: 'Ouvrir le compte rendu',
      attachments: [attachment],
    });
    if (result.envoye || result.mode === 'simulation') {
      nbOk += 1;
    }
  }

  logger.info(
    {
      compte_rendu_id: opts.cr.id,
      reunion_id: opts.cr.reunion_id,
      nb_destinataires: uniques.length,
      nb_emails_ok: nbOk,
    },
    'Rapport CR envoyé aux participants',
  );

  return {
    envoye: nbOk > 0,
    nb_destinataires: uniques.length,
    nb_emails_ok: nbOk,
  };
}

/**
 * Si un CR validé existe pour la réunion, envoie le rapport aux participants (best-effort).
 */
export async function tenterEnvoiRapportSiPret(reunionId: string): Promise<void> {
  try {
    const supabase = requireSupabaseAdmin();
    const { data } = await supabase
      .from(TABLES.comptesRendus)
      .select('*')
      .eq('reunion_id', reunionId)
      .eq('statut', 'valide')
      .order('valide_le', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;
    await envoyerRapportAuxParticipants({ cr: data as CompteRendu });
  } catch (error) {
    logger.warn({ err: error, reunionId }, 'Échec envoi auto rapport après clôture');
  }
}
