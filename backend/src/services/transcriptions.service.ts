import { TABLES, type Transcription } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { reunionService } from './reunion.service.js';

export type SauvegarderTranscriptionInput = {
  reunion_id: string;
  langue: string;
  texte_complet: string;
  enregistrement_id?: string | null;
};

export class TranscriptionsService {
  async sauvegarder(input: SauvegarderTranscriptionInput): Promise<Transcription> {
    const texte = input.texte_complet.trim();
    if (!texte) {
      throw new AppError(400, 'Texte de transcription vide.');
    }

    await reunionService.obtenirParId(input.reunion_id);

    const langue = input.langue === 'en' || input.langue === 'en-US' ? 'en' : 'fr';
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.transcriptions)
      .insert({
        reunion_id: input.reunion_id,
        enregistrement_id: input.enregistrement_id ?? null,
        statut: 'terminee',
        langue,
        texte_complet: texte,
        traite_le: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’enregistrer la transcription.');
    }

    return data as Transcription;
  }

  async listerParReunion(reunionId: string): Promise<Transcription[]> {
    await reunionService.obtenirParId(reunionId);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.transcriptions)
      .select('*')
      .eq('reunion_id', reunionId)
      .order('cree_le', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les transcriptions.');
    }

    return (data ?? []) as Transcription[];
  }

  async supprimerParReunion(reunionId: string): Promise<number> {
    await reunionService.obtenirParId(reunionId);
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.transcriptions)
      .delete()
      .eq('reunion_id', reunionId)
      .select('id');

    if (error) {
      handleSupabaseError(error, 'Impossible de supprimer les transcriptions.');
    }
    return data?.length ?? 0;
  }
}

export const transcriptionsService = new TranscriptionsService();
