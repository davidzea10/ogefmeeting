import type {
  DashboardAdminStats,
  DashboardReunionParDirection,
  DashboardReunionParSemaine,
  DashboardReunionsParStatutMois,
  DashboardResume,
} from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

function debutMoisISO(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

function finMoisISO(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

function moisLibelle(d = new Date()): string {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(d);
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

    let reunions_participations_mois = 0;
    if (scopeProfil) {
      const { data: liensParticipation, error: liensParticipationError } = await supabase
        .from(TABLES.participantsReunion)
        .select('reunion_id')
        .eq('profil_id', scopeProfil);
      if (liensParticipationError) {
        handleSupabaseError(
          liensParticipationError,
          'Impossible de charger vos participations.',
        );
      }
      const idsParticipation = (liensParticipation ?? []).map((l) => l.reunion_id as string);
      if (idsParticipation.length > 0) {
        reunions_participations_mois = await countExact(
          supabase
            .from(TABLES.reunions)
            .select('*', { count: 'exact', head: true })
            .in('id', idsParticipation)
            .gte('date_prevue', debutMois)
            .lte('date_prevue', finMois)
            .neq('statut', 'archivee'),
          'Impossible de compter vos participations du mois.',
        );
      }
    }

    const reunions_proposees = scopeProfil
      ? await countExact(
          supabase
            .from(TABLES.reunions)
            .select('*', { count: 'exact', head: true })
            .eq('cree_par', scopeProfil)
            .eq('statut', 'en_attente_validation'),
          'Impossible de compter vos propositions.',
        )
      : 0;

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
              .in('statut', ['en_cours', 'en_pause']);
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

    return {
      reunions_a_venir,
      reunions_en_cours,
      reunions_mois,
      reunions_participations_mois,
      reunions_proposees,
      cr_brouillons,
      cr_soumis,
      cr_valides_mois,
      cr_crees_mois,
      taux_validation_mois,
      actions_ouvertes,
      actions_en_retard,
      mes_actions_ouvertes,
      mois_libelle: moisLibelle(maintenant),
    };
  }

  async adminStats(): Promise<DashboardAdminStats> {
    const supabase = requireSupabaseAdmin();
    const maintenant = new Date();
    const debutMois = debutMoisISO(maintenant);
    const finMois = finMoisISO(maintenant);
    const aujourdHui = maintenant.toISOString().slice(0, 10);

    const countExact = async (
      result: PromiseLike<{ count: number | null; error: unknown }>,
      message: string,
    ): Promise<number> => {
      const { count, error } = await result;
      if (error) handleSupabaseError(error as never, message);
      return count ?? 0;
    };

    const [
      reunions_organisees_mois,
      reunions_planifiees,
      reunions_en_cours,
      reunions_cloturees,
      utilisateurs_total,
      utilisateurs_actifs,
      cr_brouillons,
      cr_soumis,
      cr_valides_mois,
      cr_crees_mois,
      actions_ouvertes,
      actions_en_retard,
      { data: reunionsMois, error: reunionsMoisError },
      { data: directions, error: directionsError },
      { data: liensDirections, error: liensDirectionsError },
    ] = await Promise.all([
      countExact(
        supabase
          .from(TABLES.reunions)
          .select('*', { count: 'exact', head: true })
          .gte('cree_le', debutMois)
          .lte('cree_le', finMois)
          .neq('statut', 'archivee'),
        'Impossible de compter les réunions organisées du mois.',
      ),
      countExact(
        supabase
          .from(TABLES.reunions)
          .select('*', { count: 'exact', head: true })
          .eq('statut', 'planifiee'),
        'Impossible de compter les réunions planifiées.',
      ),
      countExact(
        supabase
          .from(TABLES.reunions)
          .select('*', { count: 'exact', head: true })
          .in('statut', ['en_cours', 'en_pause']),
        'Impossible de compter les réunions en cours.',
      ),
      countExact(
        supabase
          .from(TABLES.reunions)
          .select('*', { count: 'exact', head: true })
          .eq('statut', 'cloturee'),
        'Impossible de compter les réunions clôturées.',
      ),
      countExact(
        supabase.from(TABLES.profils).select('*', { count: 'exact', head: true }),
        'Impossible de compter les utilisateurs.',
      ),
      countExact(
        supabase
          .from(TABLES.profils)
          .select('*', { count: 'exact', head: true })
          .eq('est_actif', true),
        'Impossible de compter les utilisateurs actifs.',
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
      supabase
        .from(TABLES.reunions)
        .select('id, statut, cree_le, direction_id')
        .gte('cree_le', debutMois)
        .lte('cree_le', finMois)
        .neq('statut', 'archivee'),
      supabase.from(TABLES.directions).select('id, nom, code').order('nom'),
      supabase.from(TABLES.reunionsDirections).select('reunion_id, direction_id'),
    ]);

    if (reunionsMoisError) {
      handleSupabaseError(reunionsMoisError, 'Impossible de charger les réunions du mois.');
    }
    if (directionsError) {
      handleSupabaseError(directionsError, 'Impossible de charger les directions.');
    }
    if (liensDirectionsError) {
      handleSupabaseError(liensDirectionsError, 'Impossible de charger les directions liées.');
    }

    const reunions_par_statut_mois: DashboardReunionsParStatutMois = {
      planifiee: 0,
      en_cours: 0,
      en_pause: 0,
      cloturee: 0,
      en_attente_validation: 0,
      refusee: 0,
    };

    const directionCounts = new Map<string, number>();
    for (const d of directions ?? []) {
      directionCounts.set(d.id as string, 0);
    }

    const liensParReunion = new Map<string, string[]>();
    for (const lien of liensDirections ?? []) {
      const rid = lien.reunion_id as string;
      const did = lien.direction_id as string;
      const arr = liensParReunion.get(rid) ?? [];
      arr.push(did);
      liensParReunion.set(rid, arr);
    }

    const semaineCounts = new Map<number, number>();
    for (let w = 1; w <= 5; w++) semaineCounts.set(w, 0);

    for (const r of reunionsMois ?? []) {
      const statut = r.statut as keyof DashboardReunionsParStatutMois;
      if (statut in reunions_par_statut_mois) {
        reunions_par_statut_mois[statut] += 1;
      }

      const reunionId = r.id as string;
      const directionIds = liensParReunion.get(reunionId) ?? [];
      const primary = r.direction_id as string | null;
      const cibles = new Set<string>(
        directionIds.length > 0
          ? directionIds
          : primary
            ? [primary]
            : [],
      );
      for (const did of cibles) {
        directionCounts.set(did, (directionCounts.get(did) ?? 0) + 1);
      }

      const creeLe = new Date(r.cree_le as string);
      const semaine = Math.min(5, Math.ceil(creeLe.getDate() / 7));
      semaineCounts.set(semaine, (semaineCounts.get(semaine) ?? 0) + 1);
    }

    const reunions_par_direction: DashboardReunionParDirection[] = (directions ?? [])
      .map((d) => ({
        direction_id: d.id as string,
        nom: d.nom as string,
        code: (d.code as string | null) ?? null,
        count: directionCounts.get(d.id as string) ?? 0,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const reunions_par_semaine: DashboardReunionParSemaine[] = [1, 2, 3, 4, 5].map(
      (semaine) => ({
        semaine,
        libelle: `Sem. ${semaine}`,
        count: semaineCounts.get(semaine) ?? 0,
      }),
    );

    const taux_validation_mois =
      cr_crees_mois > 0
        ? Math.round((cr_valides_mois / cr_crees_mois) * 1000) / 10
        : null;

    return {
      mois_libelle: moisLibelle(maintenant),
      debut_mois: debutMois,
      fin_mois: finMois,
      reunions_organisees_mois,
      reunions_par_statut_mois,
      reunions_planifiees,
      reunions_en_cours,
      reunions_cloturees,
      reunions_par_direction,
      reunions_par_semaine,
      utilisateurs_total,
      utilisateurs_actifs,
      cr_brouillons,
      cr_soumis,
      cr_valides_mois,
      cr_crees_mois,
      taux_validation_mois,
      actions_ouvertes,
      actions_en_retard,
    };
  }
}

export const dashboardService = new DashboardService();
