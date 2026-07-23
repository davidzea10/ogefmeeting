import type { ParametresApplication } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type { ModifierParametresInput } from '../schemas/parametres.schemas.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

const DEFAUT: ParametresApplication = {
  id: 1,
  logo_url: null,
  en_tete_pdf: 'OGEFREM — Office de Gestion du Fret Multimodal',
  sous_titre_pdf: 'Ogefmeeting — Compte rendu de réunion',
  duree_retention_jours: 365,
  modifie_le: new Date(0).toISOString(),
  modifie_par: null,
};

export class ParametresService {
  async obtenir(): Promise<ParametresApplication> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.parametresApplication)
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'Impossible de charger les paramètres.');
    }

    return (data as ParametresApplication | null) ?? DEFAUT;
  }

  async modifier(
    input: ModifierParametresInput,
    modifiePar?: string,
  ): Promise<ParametresApplication> {
    const actuel = await this.obtenir();
    const supabase = requireSupabaseAdmin();
    const payload = {
      id: 1,
      logo_url:
        input.logo_url !== undefined ? input.logo_url : actuel.logo_url,
      en_tete_pdf: input.en_tete_pdf ?? actuel.en_tete_pdf,
      sous_titre_pdf: input.sous_titre_pdf ?? actuel.sous_titre_pdf,
      duree_retention_jours:
        input.duree_retention_jours ?? actuel.duree_retention_jours,
      modifie_le: new Date().toISOString(),
      modifie_par: modifiePar ?? null,
    };

    const { data, error } = await supabase
      .from(TABLES.parametresApplication)
      .upsert(payload)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’enregistrer les paramètres.');
    }

    return data as ParametresApplication;
  }
}

export const parametresService = new ParametresService();
