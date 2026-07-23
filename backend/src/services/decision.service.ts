import type { Decision, PaginatedResult } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type {
  CreerDecisionInput,
  ListerDecisionsQuery,
  ModifierDecisionInput,
} from '../schemas/decision.schemas.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

export class DecisionService {
  async creer(input: CreerDecisionInput): Promise<Decision> {
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.decisions)
      .insert({
        reunion_id: input.reunion_id,
        titre: input.titre,
        description: input.description ?? null,
        compte_rendu_id: input.compte_rendu_id ?? null,
        decide_le: input.decide_le ?? new Date().toISOString(),
        cree_par: input.cree_par ?? null,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer la décision.');
    }

    return data as Decision;
  }

  async lister(query: ListerDecisionsQuery): Promise<PaginatedResult<Decision>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, tri, ordre, reunion_id, compte_rendu_id } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let builder = supabase.from(TABLES.decisions).select('*', { count: 'exact' });

    if (reunion_id) builder = builder.eq('reunion_id', reunion_id);
    if (compte_rendu_id) builder = builder.eq('compte_rendu_id', compte_rendu_id);

    const { data, error, count } = await builder
      .order(tri, { ascending: ordre === 'asc' })
      .range(from, to);

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les décisions.');
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as Decision[],
      pagination: {
        page,
        limite,
        total,
        total_pages: Math.max(1, Math.ceil(total / limite)),
      },
    };
  }

  async obtenirParId(id: string): Promise<Decision> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.decisions)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'Décision introuvable.');
    }

    return data as Decision;
  }

  async modifier(id: string, input: ModifierDecisionInput): Promise<Decision> {
    await this.obtenirParId(id);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.decisions)
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier la décision.');
    }

    return data as Decision;
  }

  async supprimer(id: string): Promise<void> {
    await this.obtenirParId(id);
    const supabase = requireSupabaseAdmin();

    const { error } = await supabase.from(TABLES.decisions).delete().eq('id', id);

    if (error) {
      handleSupabaseError(error, 'Impossible de supprimer la décision.');
    }
  }
}

export const decisionService = new DecisionService();
