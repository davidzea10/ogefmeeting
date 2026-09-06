import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DocumentLiveEtat,
  DocumentReunionAvecUrl,
} from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { obtenirEtatDocumentLive, publierDocumentLive } from '../ws/document-broadcast.js';

export type FichierDocumentUpload = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
};

const MIME_PDF = 'application/pdf';
const MIME_DOC = 'application/msword';
const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MIMES_ACCEPTES = new Set([MIME_PDF, MIME_DOC, MIME_DOCX]);

function nettoyerNomFichier(nom: string): string {
  return nom
    .replace(/\\/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);
}

function normaliserMime(mimeType: string, filename: string): string {
  const m = mimeType.toLowerCase().trim();
  const lower = filename.toLowerCase();
  if (m.includes('pdf') || lower.endsWith('.pdf')) return MIME_PDF;
  if (
    m.includes('wordprocessingml') ||
    m === MIME_DOCX ||
    lower.endsWith('.docx')
  ) {
    return MIME_DOCX;
  }
  if (m === 'application/msword' || lower.endsWith('.doc')) return MIME_DOC;
  return m || 'application/octet-stream';
}

export function estDocumentPresentable(typeMime: string): boolean {
  return typeMime.toLowerCase().includes('pdf');
}

async function obtenirReunion(supabase: SupabaseClient, reunionId: string) {
  const { data, error } = await supabase
    .from(TABLES.reunions)
    .select('id, statut, document_live_id, document_live_page, document_live_scroll')
    .eq('id', reunionId)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Impossible de charger la réunion.');
  if (!data) throw new AppError(404, 'Réunion introuvable.');
  return data as {
    id: string;
    statut: string;
    document_live_id: string | null;
    document_live_page: number | null;
    document_live_scroll: number | null;
  };
}

async function urlSignee(cheminStockage: string): Promise<string> {
  const supabase = requireSupabaseAdmin();
  const { data: signed, error } = await supabase.storage
    .from('documents')
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
  televerse_par: string | null;
  cree_le: string;
};

function versPublic(row: RowDb, urlLecture = ''): DocumentReunionAvecUrl {
  return {
    id: row.id,
    reunion_id: row.reunion_id,
    nom_fichier: row.nom_fichier,
    type_mime: row.type_mime,
    taille_octets: row.taille_octets,
    televerse_par: row.televerse_par,
    cree_le: row.cree_le,
    url_lecture: urlLecture,
    presentable: estDocumentPresentable(row.type_mime),
  };
}

export class DocumentsReunionService {
  async televerser(opts: {
    reunionId: string;
    fichier: FichierDocumentUpload;
    televerseParId: string;
  }): Promise<DocumentReunionAvecUrl> {
    const supabase = requireSupabaseAdmin();
    const reunion = await obtenirReunion(supabase, opts.reunionId);

    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(
        400,
        `Upload impossible : la réunion doit être en cours ou en pause (statut : ${reunion.statut}).`,
      );
    }

    if (opts.fichier.size > 50 * 1024 * 1024) {
      throw new AppError(413, 'Fichier trop volumineux (max 50 Mo).');
    }

    const nomFichier = nettoyerNomFichier(opts.fichier.filename || 'document.pdf');
    const typeMime = normaliserMime(opts.fichier.mimeType, nomFichier);
    if (!MIMES_ACCEPTES.has(typeMime)) {
      throw new AppError(
        400,
        'Format non supporté. Envoyez un PDF (recommandé pour le suivi sync) ou un Word (.doc / .docx).',
      );
    }

    const id = crypto.randomUUID();
    const cheminStockage = `${opts.reunionId}/${id}/${nomFichier}`;

    const uploadRes = await supabase.storage
      .from('documents')
      .upload(cheminStockage, opts.fichier.buffer, {
        contentType: typeMime,
        upsert: false,
      });

    if (uploadRes.error) {
      throw new AppError(
        500,
        `Échec upload Storage : ${uploadRes.error.message}`,
      );
    }

    const { data, error } = await supabase
      .from(TABLES.documentsReunion)
      .insert({
        id,
        reunion_id: opts.reunionId,
        nom_fichier: nomFichier,
        chemin_stockage: cheminStockage,
        type_mime: typeMime,
        taille_octets: opts.fichier.size,
        televerse_par: opts.televerseParId,
      })
      .select('*')
      .single();

    if (error) {
      await supabase.storage.from('documents').remove([cheminStockage]);
      handleSupabaseError(error, 'Impossible d’enregistrer le document.');
    }

    const row = data as RowDb;
    const url = await urlSignee(cheminStockage);
    return versPublic(row, url);
  }

  async lister(reunionId: string): Promise<DocumentReunionAvecUrl[]> {
    const supabase = requireSupabaseAdmin();
    await obtenirReunion(supabase, reunionId);

    const { data, error } = await supabase
      .from(TABLES.documentsReunion)
      .select('*')
      .eq('reunion_id', reunionId)
      .order('cree_le', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les documents.');
    }

    const rows = (data ?? []) as RowDb[];
    const out: DocumentReunionAvecUrl[] = [];
    for (const row of rows) {
      try {
        const url = await urlSignee(row.chemin_stockage);
        out.push(versPublic(row, url));
      } catch {
        out.push(versPublic(row, ''));
      }
    }
    return out;
  }

  async obtenirUrl(id: string): Promise<DocumentReunionAvecUrl> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.documentsReunion)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Impossible de charger le document.');
    if (!data) throw new AppError(404, 'Document introuvable.');

    const row = data as RowDb;
    const url = await urlSignee(row.chemin_stockage);
    return versPublic(row, url);
  }

  /** Contenu binaire (proxy) — évite CORS Supabase côté pdf.js. */
  async telechargerContenu(id: string): Promise<{
    buffer: Buffer;
    typeMime: string;
    nomFichier: string;
  }> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.documentsReunion)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Impossible de charger le document.');
    if (!data) throw new AppError(404, 'Document introuvable.');

    const row = data as RowDb;
    const { data: blob, error: dlError } = await supabase.storage
      .from('documents')
      .download(row.chemin_stockage);

    if (dlError || !blob) {
      throw new AppError(
        500,
        `Impossible de télécharger le fichier : ${dlError?.message ?? 'fichier absent'}`,
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    return {
      buffer,
      typeMime: row.type_mime || 'application/octet-stream',
      nomFichier: row.nom_fichier,
    };
  }

  async supprimer(id: string): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.documentsReunion)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Impossible de charger le document.');
    if (!data) throw new AppError(404, 'Document introuvable.');

    const row = data as RowDb;

    await supabase
      .from(TABLES.reunions)
      .update({
        document_live_id: null,
        document_live_page: 1,
        document_live_scroll: 0,
      })
      .eq('document_live_id', id);

    const { error: delError } = await supabase
      .from(TABLES.documentsReunion)
      .delete()
      .eq('id', id);

    if (delError) {
      handleSupabaseError(delError, 'Impossible de supprimer le document.');
    }

    await supabase.storage.from('documents').remove([row.chemin_stockage]);

    publierDocumentLive(row.reunion_id, {
      document_id: null,
      page: 1,
      scroll_ratio: 0,
    });
  }

  /** Active un PDF comme document présenté (ou désactive si documentId null). */
  async presenter(opts: {
    reunionId: string;
    documentId: string | null;
  }): Promise<DocumentLiveEtat> {
    const supabase = requireSupabaseAdmin();
    const reunion = await obtenirReunion(supabase, opts.reunionId);

    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(400, 'Présentation possible uniquement en live.');
    }

    let etat: DocumentLiveEtat = {
      document_id: null,
      page: 1,
      scroll_ratio: 0,
    };

    if (opts.documentId) {
      const { data, error } = await supabase
        .from(TABLES.documentsReunion)
        .select('*')
        .eq('id', opts.documentId)
        .eq('reunion_id', opts.reunionId)
        .maybeSingle();

      if (error) handleSupabaseError(error, 'Impossible de charger le document.');
      if (!data) throw new AppError(404, 'Document introuvable pour cette réunion.');

      const row = data as RowDb;
      if (!estDocumentPresentable(row.type_mime)) {
        throw new AppError(
          400,
          'Seuls les PDF peuvent être présentés en suivi synchronisé. Convertissez le Word en PDF.',
        );
      }

      const url = await urlSignee(row.chemin_stockage);
      etat = {
        document_id: row.id,
        page: 1,
        scroll_ratio: 0,
        nom_fichier: row.nom_fichier,
        type_mime: row.type_mime,
        url_lecture: url,
        presentable: true,
      };
    }

    const { error: upError } = await supabase
      .from(TABLES.reunions)
      .update({
        document_live_id: etat.document_id,
        document_live_page: etat.page,
        document_live_scroll: etat.scroll_ratio,
      })
      .eq('id', opts.reunionId);

    if (upError) {
      handleSupabaseError(upError, 'Impossible d’activer la présentation.');
    }

    publierDocumentLive(opts.reunionId, etat);
    return etat;
  }

  async synchroniserLive(opts: {
    reunionId: string;
    documentId?: string | null;
    page?: number;
    scrollRatio?: number;
  }): Promise<DocumentLiveEtat> {
    const supabase = requireSupabaseAdmin();
    const reunion = await obtenirReunion(supabase, opts.reunionId);

    const documentId =
      opts.documentId !== undefined
        ? opts.documentId
        : reunion.document_live_id;

    if (!documentId) {
      const etatVide: DocumentLiveEtat = {
        document_id: null,
        page: 1,
        scroll_ratio: 0,
      };
      publierDocumentLive(opts.reunionId, etatVide);
      return etatVide;
    }

    const { data, error } = await supabase
      .from(TABLES.documentsReunion)
      .select('*')
      .eq('id', documentId)
      .eq('reunion_id', opts.reunionId)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Impossible de charger le document.');
    if (!data) throw new AppError(404, 'Document introuvable.');

    const row = data as RowDb;
    const page = Math.max(1, Math.floor(opts.page ?? reunion.document_live_page ?? 1));
    const scrollRatio = Math.min(
      1,
      Math.max(0, Number(opts.scrollRatio ?? reunion.document_live_scroll ?? 0)),
    );

    const { error: upError } = await supabase
      .from(TABLES.reunions)
      .update({
        document_live_id: documentId,
        document_live_page: page,
        document_live_scroll: scrollRatio,
      })
      .eq('id', opts.reunionId);

    if (upError) {
      // colonnes absentes si migration non appliquée — on diffuse quand même
      if (!String(upError.message ?? '').includes('document_live')) {
        handleSupabaseError(upError, 'Impossible de synchroniser le document live.');
      }
    }

    // Pas de nouvelle URL signée à chaque scroll — réutilise celle en mémoire
    const memoire = obtenirEtatDocumentLive(opts.reunionId);
    const urlExistante =
      memoire.document_id === documentId ? memoire.url_lecture : null;

    const etat: DocumentLiveEtat = {
      document_id: documentId,
      page,
      scroll_ratio: scrollRatio,
      nom_fichier: row.nom_fichier,
      type_mime: row.type_mime,
      url_lecture: urlExistante ?? undefined,
      presentable: estDocumentPresentable(row.type_mime),
    };

    publierDocumentLive(opts.reunionId, etat);
    return {
      ...etat,
      url_lecture: urlExistante ?? null,
    };
  }

  async obtenirLive(reunionId: string): Promise<DocumentLiveEtat> {
    const supabase = requireSupabaseAdmin();
    const reunion = await obtenirReunion(supabase, reunionId);

    if (!reunion.document_live_id) {
      return { document_id: null, page: 1, scroll_ratio: 0 };
    }

    const memoire = obtenirEtatDocumentLive(reunionId);
    const page = Math.max(1, reunion.document_live_page ?? 1);
    const scrollRatio = Math.min(
      1,
      Math.max(0, Number(reunion.document_live_scroll ?? 0)),
    );

    // Réutilise l’URL en mémoire si même document (évite nouvelles URLs signées → reload PDF)
    if (
      memoire.document_id === reunion.document_live_id &&
      memoire.url_lecture
    ) {
      return {
        document_id: reunion.document_live_id,
        page,
        scroll_ratio: scrollRatio,
        nom_fichier: memoire.nom_fichier ?? null,
        type_mime: memoire.type_mime ?? null,
        url_lecture: memoire.url_lecture,
        presentable: memoire.presentable ?? true,
      };
    }

    try {
      const doc = await this.obtenirUrl(reunion.document_live_id);
      return {
        document_id: doc.id,
        page,
        scroll_ratio: scrollRatio,
        nom_fichier: doc.nom_fichier,
        type_mime: doc.type_mime,
        url_lecture: doc.url_lecture,
        presentable: doc.presentable,
      };
    } catch {
      return { document_id: null, page: 1, scroll_ratio: 0 };
    }
  }

  async effacerLive(reunionId: string): Promise<void> {
    const supabase = requireSupabaseAdmin();
    await supabase
      .from(TABLES.reunions)
      .update({
        document_live_id: null,
        document_live_page: 1,
        document_live_scroll: 0,
      })
      .eq('id', reunionId);

    publierDocumentLive(reunionId, {
      document_id: null,
      page: 1,
      scroll_ratio: 0,
    });
  }
}

export const documentsReunionService = new DocumentsReunionService();
