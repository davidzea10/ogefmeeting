import type { ActionSuivi, PaginatedResult } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type {
  CreerActionInput,
  ListerActionsQuery,
  ModifierActionInput,
} from '../schemas/action.schemas.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

export class ActionService {
  async creer(input: CreerActionInput): Promise<ActionSuivi> {
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.actions)
      .insert({
        reunion_id: input.reunion_id,
        titre: input.titre,
        description: input.description ?? null,
        responsable_id: input.responsable_id ?? null,
        priorite: input.priorite,
        statut: input.statut,
        date_echeance: input.date_echeance ?? null,
        compte_rendu_id: input.compte_rendu_id ?? null,
        decision_id: input.decision_id ?? null,
        cree_par: input.cree_par ?? null,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer l’action.');
    }

    return data as ActionSuivi;
  }

  async lister(query: ListerActionsQuery): Promise<PaginatedResult<ActionSuivi>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, tri, ordre, statut, priorite, reunion_id, responsable_id } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let builder = supabase.from(TABLES.actions).select('*', { count: 'exact' });

    if (statut) builder = builder.eq('statut', statut);
    if (priorite) builder = builder.eq('priorite', priorite);
    if (reunion_id) builder = builder.eq('reunion_id', reunion_id);
    if (responsable_id) builder = builder.eq('responsable_id', responsable_id);

    const { data, error, count } = await builder
      .order(tri, { ascending: ordre === 'asc', nullsFirst: false })
      .range(from, to);

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les actions.');
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as ActionSuivi[],
      pagination: {
        page,
        limite,
        total,
        total_pages: Math.max(1, Math.ceil(total / limite)),
      },
    };
  }

  async obtenirParId(id: string): Promise<ActionSuivi> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.actions)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'Action introuvable.');
    }

    return data as ActionSuivi;
  }

  async modifier(id: string, input: ModifierActionInput): Promise<ActionSuivi> {
    await this.obtenirParId(id);
    const supabase = requireSupabaseAdmin();

    const payload: Record<string, unknown> = { ...input };
    if (input.statut === 'terminee') {
      payload.termine_le = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(TABLES.actions)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier l’action.');
    }

    return data as ActionSuivi;
  }

  async supprimer(id: string): Promise<void> {
    await this.obtenirParId(id);
    const supabase = requireSupabaseAdmin();

    const { error } = await supabase.from(TABLES.actions).delete().eq('id', id);

    if (error) {
      handleSupabaseError(error, 'Impossible de supprimer l’action.');
    }
  }
}

export const actionService = new ActionService();
