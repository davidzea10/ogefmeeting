import type { CompteRendu } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { envoyerEmail } from './email.service.js';

type ProfilDestinataire = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
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

    const html = `
      <p>${message}</p>
      ${motif ? `<p><strong>Commentaire :</strong> ${escapeHtml(motif)}</p>` : ''}
      <p><a href="${lien}">Ouvrir le compte rendu</a></p>
      <p style="color:#666;font-size:12px;">Ogefmeeting — OGEFREM</p>
    `;

    for (const dest of destinataires) {
      if (!dest.email) continue;
      await envoyerEmail({
        to: dest.email,
        subject: sujet,
        html,
        text: `${message}\n\nLien : ${lien}`,
      });
    }
  } catch (error) {
    logger.warn({ err: error }, 'Échec notification changement statut CR');
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
