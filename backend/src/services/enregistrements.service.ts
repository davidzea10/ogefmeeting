import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnregistrementAvecUrl } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { requireSupabaseAdmin } from '../lib/supabase.js';

export type FichierAudioUpload = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
};

function nettoyerNomFichier(nom: string): string {
  return nom
    .replace(/\\/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);
}

function normaliserTypeMime(mimeType: string): string {
  const m = mimeType.toLowerCase();

  if (m.includes('webm')) return 'audio/webm';
  if (m.includes('wav')) return 'audio/wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'audio/mpeg';
  if (m.includes('mp4') || m.includes('m4a')) return 'audio/mp4';
  if (m.includes('ogg')) return 'audio/ogg';

  return 'audio/webm';
}

async function obtenirReunionPourStatut(supabase: SupabaseClient, reunionId: string) {
  const { data: reunion, error } = await supabase
    .from(TABLES.reunions)
    .select('id, statut')
    .eq('id', reunionId)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Impossible de charger la réunion.');
  if (!reunion) {
    throw new AppError(404, 'Réunion introuvable.');
  }

  return reunion as { id: string; statut: string };
}

async function urlSignee(cheminStockage: string): Promise<string> {
  const supabase = requireSupabaseAdmin();
  const { data: signed, error } = await supabase.storage
    .from('recordings')
    .createSignedUrl(cheminStockage, 60 * 60);

  if (error || !signed?.signedUrl) {
    throw new AppError(
      500,
      `Impossible de générer l’URL signée : ${(error as { message?: string })?.message ?? 'erreur storage'}`,
    );
  }

  return signed.signedUrl;
}

type RowDb = {
  id: string;
  reunion_id: string;
  chemin_stockage: string;
  nom_fichier: string;
  type_mime: string;
  taille_octets: number | null;
  duree_secondes: number | null;
  televerse_par: string | null;
  cree_le: string;
};

function versEnregistrementPublic(row: RowDb, urlLecture = ''): EnregistrementAvecUrl {
  return {
    id: row.id,
    reunion_id: row.reunion_id,
    nom_fichier: row.nom_fichier,
    type_mime: row.type_mime,
    taille_octets: row.taille_octets,
    duree_secondes: row.duree_secondes,
    televerse_par: row.televerse_par,
    cree_le: row.cree_le,
    url_lecture: urlLecture,
  };
}

export class EnregistrementsService {
  async televerser(opts: {
    reunionId: string;
    fichier: FichierAudioUpload;
    televerseParId: string;
    dureeSecondes?: number | null;
  }): Promise<EnregistrementAvecUrl> {
    const supabase = requireSupabaseAdmin();

    const reunion = await obtenirReunionPourStatut(supabase, opts.reunionId);
    if (reunion.statut !== 'en_cours') {
      throw new AppError(
        400,
        `Enregistrement impossible : la réunion n’est pas en cours (statut : ${reunion.statut}).`,
      );
    }

    if (opts.fichier.size > 200 * 1024 * 1024) {
      throw new AppError(413, 'Fichier audio trop volumineux (max 200 Mo).');
    }

    const id = crypto.randomUUID();
    const nomFichier = nettoyerNomFichier(opts.fichier.filename || 'audio.webm');
    const cheminStockage = `${opts.reunionId}/${id}/${nomFichier}`;
    const typeMimeNormalise = normaliserTypeMime(opts.fichier.mimeType);

    const uploadRes = await supabase.storage
      .from('recordings')
      .upload(cheminStockage, opts.fichier.buffer, {
        contentType: typeMimeNormalise,
        upsert: false,
      });

    if (uploadRes.error) {
      throw new AppError(
        500,
        `Impossible de téléverser l’audio : ${
          (uploadRes.error as { message?: string })?.message ?? 'erreur storage'
        }`,
      );
    }

    const { data: enregistrement, error: insertError } = await supabase
      .from(TABLES.enregistrements)
      .insert({
        id,
        reunion_id: opts.reunionId,
        chemin_stockage: cheminStockage,
        nom_fichier: nomFichier,
        type_mime: typeMimeNormalise,
        taille_octets: opts.fichier.size,
        duree_secondes: opts.dureeSecondes ?? null,
        televerse_par: opts.televerseParId,
      })
      .select('*')
      .single();

    if (insertError || !enregistrement) {
      if (insertError) handleSupabaseError(insertError, 'Impossible d’enregistrer la métadonnée audio.');
      throw new AppError(500, 'Enregistrement audio introuvable après insertion.');
    }

    const url = await urlSignee(cheminStockage);
    const row = enregistrement as unknown as RowDb;
    return versEnregistrementPublic(row, url);
  }

  async listerParReunion(reunionId: string): Promise<EnregistrementAvecUrl[]> {
    const supabase = requireSupabaseAdmin();

    const { data: enregistrements, error } = await supabase
      .from(TABLES.enregistrements)
      .select('*')
      .eq('reunion_id', reunionId)
      .order('cree_le', { ascending: false });

    if (error) handleSupabaseError(error, 'Impossible de lister les enregistrements.');

    const result: EnregistrementAvecUrl[] = [];
    for (const row of enregistrements ?? []) {
      const r = row as unknown as RowDb;
      try {
        const url = await urlSignee(r.chemin_stockage);
        result.push(versEnregistrementPublic(r, url));
      } catch {
        result.push(versEnregistrementPublic(r, ''));
      }
    }
    return result;
  }

  async obtenirUrlLecture(id: string): Promise<EnregistrementAvecUrl> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.enregistrements)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Impossible de charger l’enregistrement.');
    if (!data) throw new AppError(404, 'Enregistrement introuvable.');

    const chemin = (data as RowDb).chemin_stockage;
    const url = await urlSignee(chemin);
    return versEnregistrementPublic(data as unknown as RowDb, url);
  }

  async supprimer(id: string): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.enregistrements)
      .select('id, chemin_stockage')
      .eq('id', id)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Impossible de charger l’enregistrement.');
    if (!data) throw new AppError(404, 'Enregistrement introuvable.');

    const chemin = (data as { chemin_stockage: string }).chemin_stockage;

    const { error: storageErr } = await supabase.storage.from('recordings').remove([chemin]);
    if (storageErr) {
      throw new AppError(
        500,
        `Impossible de supprimer le fichier audio : ${(storageErr as { message?: string })?.message ?? 'erreur storage'}`,
      );
    }

    const { error: deleteErr } = await supabase.from(TABLES.enregistrements).delete().eq('id', id);
    if (deleteErr) handleSupabaseError(deleteErr, 'Impossible de supprimer l’enregistrement.');
  }

  /** Supprime tous les enregistrements audio d’une réunion (fichiers + lignes). */
  async supprimerParReunion(reunionId: string): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.enregistrements)
      .select('id, chemin_stockage')
      .eq('reunion_id', reunionId);

    if (error) handleSupabaseError(error, 'Impossible de lister les enregistrements.');

    const rows = (data ?? []) as { id: string; chemin_stockage: string }[];
    if (rows.length === 0) return 0;

    const chemins = rows.map((r) => r.chemin_stockage).filter(Boolean);
    if (chemins.length > 0) {
      await supabase.storage.from('recordings').remove(chemins);
    }

    const { error: deleteErr } = await supabase
      .from(TABLES.enregistrements)
      .delete()
      .eq('reunion_id', reunionId);

    if (deleteErr) handleSupabaseError(deleteErr, 'Impossible de supprimer les enregistrements.');
    return rows.length;
  }
}

export const enregistrementsService = new EnregistrementsService();
