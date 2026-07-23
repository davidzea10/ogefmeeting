import type { DashboardResume } from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

function debutMoisISO(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

function finMoisISO(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

export class DashboardService {
  async resume(
    profilId?: string | null,
    options: { limiterReunionsAuProfilId?: string | null } = {},
  ): Promise<DashboardResume> {
    const supabase = requireSupabaseAdmin();
    const maintenant = new Date();
    const debutMois = debutMoisISO(maintenant);
    const finMois = finMoisISO(maintenant);
    const maintenantISO = maintenant.toISOString();
    const aujourdHui = maintenantISO.slice(0, 10);

    const scopeProfil = options.limiterReunionsAuProfilId ?? null;
    let idsReunions: string[] | null = null;
    if (scopeProfil) {
      const [{ data: liens, error: liensError }, { data: creees, error: creeesError }] =
        await Promise.all([
          supabase
            .from(TABLES.participantsReunion)
            .select('reunion_id')
            .eq('profil_id', scopeProfil),
          supabase.from(TABLES.reunions).select('id').eq('cree_par', scopeProfil),
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
    }

    const countExact = async (
      result: PromiseLike<{ count: number | null; error: unknown }>,
      message: string,
    ): Promise<number> => {
      const { count, error } = await result;
      if (error) handleSupabaseError(error as never, message);
      return count ?? 0;
    };

    const zeroSiVide =
      idsReunions !== null && idsReunions.length === 0
        ? Promise.resolve(0)
        : null;

    const [
      reunions_a_venir,
      reunions_en_cours,
      reunions_mois,
      cr_brouillons,
      cr_soumis,
      cr_valides_mois,
      cr_crees_mois,
      actions_ouvertes,
      actions_en_retard,
      mes_actions_ouvertes,
    ] = await Promise.all([
      zeroSiVide ??
        countExact(
          (() => {
            let q = supabase
              .from(TABLES.reunions)
              .select('*', { count: 'exact', head: true })
              .eq('statut', 'planifiee')
              .gte('date_prevue', maintenantISO);
            if (idsReunions) q = q.in('id', idsReunions);
            return q;
          })(),
          'Impossible de compter les réunions à venir.',
        ),
      zeroSiVide ??
        countExact(
          (() => {
            let q = supabase
              .from(TABLES.reunions)
              .select('*', { count: 'exact', head: true })
              .eq('statut', 'en_cours');
            if (idsReunions) q = q.in('id', idsReunions);
            return q;
          })(),
          'Impossible de compter les réunions en cours.',
        ),
      zeroSiVide ??
        countExact(
          (() => {
            let q = supabase
              .from(TABLES.reunions)
              .select('*', { count: 'exact', head: true })
              .gte('date_prevue', debutMois)
              .lte('date_prevue', finMois)
              .neq('statut', 'archivee');
            if (idsReunions) q = q.in('id', idsReunions);
            return q;
          })(),
          'Impossible de compter les réunions du mois.',
        ),
      countExact(
        supabase
          .from(TABLES.comptesRendus)
          .select('*', { count: 'exact', head: true })
          .eq('statut', 'brouillon'),
        'Impossible de compter les brouillons CR.',
      ),
      countExact(
        supabase
          .from(TABLES.comptesRendus)
          .select('*', { count: 'exact', head: true })
          .eq('statut', 'soumis'),
        'Impossible de compter les CR soumis.',
      ),
      countExact(
        supabase
          .from(TABLES.comptesRendus)
          .select('*', { count: 'exact', head: true })
          .eq('statut', 'valide')
          .gte('valide_le', debutMois)
          .lte('valide_le', finMois),
        'Impossible de compter les CR validés du mois.',
      ),
      countExact(
        supabase
          .from(TABLES.comptesRendus)
          .select('*', { count: 'exact', head: true })
          .gte('cree_le', debutMois)
          .lte('cree_le', finMois),
        'Impossible de compter les CR créés du mois.',
      ),
      countExact(
        supabase
          .from(TABLES.actions)
          .select('*', { count: 'exact', head: true })
          .in('statut', ['en_attente', 'en_cours', 'en_retard']),
        'Impossible de compter les actions ouvertes.',
      ),
      countExact(
        supabase
          .from(TABLES.actions)
          .select('*', { count: 'exact', head: true })
          .in('statut', ['en_attente', 'en_cours', 'en_retard'])
          .not('date_echeance', 'is', null)
          .lt('date_echeance', aujourdHui),
        'Impossible de compter les actions en retard.',
      ),
      profilId
        ? countExact(
            supabase
              .from(TABLES.actions)
              .select('*', { count: 'exact', head: true })
              .eq('responsable_id', profilId)
              .in('statut', ['en_attente', 'en_cours', 'en_retard']),
            'Impossible de compter vos actions.',
          )
        : Promise.resolve(0),
    ]);

    const taux_validation_mois =
      cr_crees_mois > 0
        ? Math.round((cr_valides_mois / cr_crees_mois) * 1000) / 10
        : null;

    const mois_libelle = new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(maintenant);

    return {
      reunions_a_venir,
      reunions_en_cours,
      reunions_mois,
      cr_brouillons,
      cr_soumis,
      cr_valides_mois,
      cr_crees_mois,
      taux_validation_mois,
      actions_ouvertes,
      actions_en_retard,
      mes_actions_ouvertes,
      mois_libelle,
    };
  }
}

export const dashboardService = new DashboardService();
