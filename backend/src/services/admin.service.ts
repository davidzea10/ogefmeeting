import type {
  Direction,
  ModeleCompteRendu,
  PaginatedResult,
  Profil,
  ResultatRecherche,
} from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type {
  CreerDirectionInput,
  CreerModeleInput,
  ListerProfilsQuery,
  ModifierDirectionInput,
  ModifierModeleInput,
  ModifierProfilInput,
  RechercheQuery,
} from '../schemas/admin.schemas.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

export class DirectionService {
  async lister(): Promise<Direction[]> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.directions)
      .select('*')
      .order('nom', { ascending: true });

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les directions.');
    }

    return (data ?? []) as Direction[];
  }

  async creer(input: CreerDirectionInput): Promise<Direction> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.directions)
      .insert({
        nom: input.nom,
        code: input.code ?? null,
        description: input.description ?? null,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer la direction.');
    }

    return data as Direction;
  }

  async modifier(id: string, input: ModifierDirectionInput): Promise<Direction> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.directions)
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier la direction.');
    }

    return data as Direction;
  }
}

export class ProfilService {
  async lister(query: ListerProfilsQuery): Promise<PaginatedResult<Profil>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, tri, ordre, role, direction_id, est_actif, recherche } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let builder = supabase.from(TABLES.profils).select('*', { count: 'exact' });

    if (role) builder = builder.eq('role', role);
    if (direction_id) builder = builder.eq('direction_id', direction_id);
    if (est_actif !== undefined) builder = builder.eq('est_actif', est_actif);
    if (recherche) {
      builder = builder.or(
        `prenom.ilike.%${recherche}%,nom.ilike.%${recherche}%,email.ilike.%${recherche}%`,
      );
    }

    const { data, error, count } = await builder
      .order(tri, { ascending: ordre === 'asc' })
      .range(from, to);

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les profils.');
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as Profil[],
      pagination: {
        page,
        limite,
        total,
        total_pages: Math.max(1, Math.ceil(total / limite)),
      },
    };
  }

  async obtenirParId(id: string): Promise<Profil> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.profils)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'Profil introuvable.');
    }

    return data as Profil;
  }

  async modifier(id: string, input: ModifierProfilInput): Promise<Profil> {
    await this.obtenirParId(id);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.profils)
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier le profil.');
    }

    return data as Profil;
  }
}

export class ModeleCompteRenduService {
  async lister(): Promise<ModeleCompteRendu[]> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.modelesCompteRendu)
      .select('*')
      .order('nom', { ascending: true });

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les modèles.');
    }

    return (data ?? []) as ModeleCompteRendu[];
  }

  async creer(input: CreerModeleInput): Promise<ModeleCompteRendu> {
    const supabase = requireSupabaseAdmin();

    if (input.est_par_defaut) {
      await supabase
        .from(TABLES.modelesCompteRendu)
        .update({ est_par_defaut: false })
        .eq('est_par_defaut', true);
    }

    const { data, error } = await supabase
      .from(TABLES.modelesCompteRendu)
      .insert({
        nom: input.nom,
        identifiant: input.identifiant,
        description: input.description ?? null,
        sections: input.sections,
        est_par_defaut: input.est_par_defaut,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer le modèle.');
    }

    return data as ModeleCompteRendu;
  }

  async modifier(id: string, input: ModifierModeleInput): Promise<ModeleCompteRendu> {
    const supabase = requireSupabaseAdmin();

    if (input.est_par_defaut) {
      await supabase
        .from(TABLES.modelesCompteRendu)
        .update({ est_par_defaut: false })
        .eq('est_par_defaut', true);
    }

    const { data, error } = await supabase
      .from(TABLES.modelesCompteRendu)
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier le modèle.');
    }

    return data as ModeleCompteRendu;
  }
}

export class RechercheService {
  async rechercher(
    query: RechercheQuery,
    options: { limiterReunionsAuProfilId?: string | null } = {},
  ): Promise<ResultatRecherche> {
    const supabase = requireSupabaseAdmin();
    const { q, limite } = query;
    const safe = q.replace(/[%_,()"]/g, ' ').replace(/\s+/g, ' ').trim();
    const motif = `%${safe}%`;

    let idsReunions: string[] | null = null;
    if (options.limiterReunionsAuProfilId) {
      const [{ data: liens, error: liensError }, { data: creees, error: creeesError }] =
        await Promise.all([
          supabase
            .from(TABLES.participantsReunion)
            .select('reunion_id')
            .eq('profil_id', options.limiterReunionsAuProfilId),
          supabase
            .from(TABLES.reunions)
            .select('id')
            .eq('cree_par', options.limiterReunionsAuProfilId),
        ]);
      if (liensError) {
        handleSupabaseError(liensError, 'Impossible de charger vos réunions.');
      }
      if (creeesError) {
        handleSupabaseError(creeesError, 'Impossible de charger vos propositions.');
      }
      const set = new Set<string>();
      for (const l of liens ?? []) set.add(l.reunion_id as string);
      for (const r of creees ?? []) set.add(r.id as string);
      idsReunions = [...set];
      if (idsReunions.length === 0) {
        return {
          comptes_rendus: [],
          reunions: [],
          decisions: [],
          actions: [],
        };
      }
    }

    let reunionsQuery = supabase
      .from(TABLES.reunions)
      .select('*')
      .or(`titre.ilike.${motif},description.ilike.${motif},lieu.ilike.${motif}`)
      .limit(limite);
    if (idsReunions) {
      reunionsQuery = reunionsQuery.in('id', idsReunions);
    }

    let crQuery = supabase
      .from(TABLES.comptesRendus)
      .select('*')
      .ilike('contenu_html', motif)
      .limit(limite);
    if (idsReunions) {
      crQuery = crQuery.in('reunion_id', idsReunions);
    }

    let decisionsQuery = supabase
      .from(TABLES.decisions)
      .select('*')
      .or(`titre.ilike.${motif},description.ilike.${motif}`)
      .limit(limite);
    if (idsReunions) {
      decisionsQuery = decisionsQuery.in('reunion_id', idsReunions);
    }

    let actionsQuery = supabase
      .from(TABLES.actions)
      .select('*')
      .or(`titre.ilike.${motif},description.ilike.${motif}`)
      .limit(limite);
    if (idsReunions) {
      actionsQuery = actionsQuery.in('reunion_id', idsReunions);
    }

    const [cr, reunions, decisions, actions] = await Promise.all([
      crQuery,
      reunionsQuery,
      decisionsQuery,
      actionsQuery,
    ]);

    if (cr.error) handleSupabaseError(cr.error, 'Erreur recherche comptes rendus.');
    if (reunions.error) handleSupabaseError(reunions.error, 'Erreur recherche réunions.');
    if (decisions.error) handleSupabaseError(decisions.error, 'Erreur recherche décisions.');
    if (actions.error) handleSupabaseError(actions.error, 'Erreur recherche actions.');

    return {
      comptes_rendus: (cr.data ?? []) as ResultatRecherche['comptes_rendus'],
      reunions: (reunions.data ?? []) as ResultatRecherche['reunions'],
      decisions: (decisions.data ?? []) as ResultatRecherche['decisions'],
      actions: (actions.data ?? []) as ResultatRecherche['actions'],
    };
  }
}

export const directionService = new DirectionService();
export const profilService = new ProfilService();
export const modeleCompteRenduService = new ModeleCompteRenduService();
export const rechercheService = new RechercheService();
