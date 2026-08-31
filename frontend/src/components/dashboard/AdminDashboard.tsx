import { StaggerItem, StaggerList } from '@/components/motion/StaggerList';
import { BarRow, StatCard } from '@/components/dashboard/DashboardCharts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  lienReunionsFiltrees,
  plageMoisCourant,
} from '@/lib/dashboard-api';
import { formatDateHeure, LIBELLES_STATUT } from '@/lib/labels';
import { listerReunions } from '@/lib/reunions-api';
import type { DashboardAdminStats, Reunion } from '@ogefmeeting/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  PlayCircle,
  Plus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const COULEURS_STATUT: Record<string, string> = {
  planifiee: 'bg-ogefrem-blue',
  en_cours: 'bg-success',
  en_pause: 'bg-warning',
  cloturee: 'bg-text-muted',
  en_attente_validation: 'bg-warning/80',
  refusee: 'bg-danger',
};

export function AdminDashboard({
  stats,
  loading,
}: {
  stats: DashboardAdminStats | undefined;
  loading?: boolean;
}) {
  const plage = plageMoisCourant();

  const reunionsRecentesQuery = useQuery({
    queryKey: ['dashboard', 'admin', 'reunions-recentes'],
    queryFn: () =>
      listerReunions({
        page: 1,
        limite: 6,
        tri: 'cree_le',
        ordre: 'desc',
      }),
  });

  const reunionsAValiderQuery = useQuery({
    queryKey: ['dashboard', 'admin', 'reunions-a-valider'],
    queryFn: () =>
      listerReunions({
        page: 1,
        limite: 5,
        statut: 'en_attente_validation',
        tri: 'cree_le',
        ordre: 'desc',
      }),
  });

  const maxDirection = Math.max(
    ...(stats?.reunions_par_direction.map((d) => d.count) ?? [0]),
    1,
  );
  const maxSemaine = Math.max(
    ...(stats?.reunions_par_semaine.map((s) => s.count) ?? [0]),
    1,
  );
  const maxStatutMois = Math.max(
    ...Object.values(stats?.reunions_par_statut_mois ?? { planifiee: 0 }),
    1,
  );

  const lienMois = lienReunionsFiltrees({
    date_debut: plage.date_debut,
    date_fin: plage.date_fin,
  });

  return (
    <>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            icon={CalendarDays}
            title={`Réunions organisées — ${stats?.mois_libelle ?? 'ce mois'}`}
            value={stats?.reunions_organisees_mois}
            loading={loading}
            href={lienMois}
            meta="Créées ce mois"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={PlayCircle}
            title="En cours"
            value={stats?.reunions_en_cours}
            loading={loading}
            href={lienReunionsFiltrees({ statut: 'en_cours' })}
            meta="Live ou en pause"
            accent={(stats?.reunions_en_cours ?? 0) > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={ClipboardList}
            title="Planifiées"
            value={stats?.reunions_planifiees}
            loading={loading}
            href={lienReunionsFiltrees({ statut: 'planifiee' })}
            meta="Toutes directions"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={CheckSquare}
            title="Clôturées"
            value={stats?.reunions_cloturees}
            loading={loading}
            href={lienReunionsFiltrees({ statut: 'cloturee' })}
            meta="Historique global"
          />
        </StaggerItem>
      </StaggerList>

      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            icon={Users}
            title="Utilisateurs"
            value={stats?.utilisateurs_total}
            loading={loading}
            href="/administration?tab=utilisateurs"
            meta={`${stats?.utilisateurs_actifs ?? 0} actifs`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={FileText}
            title="CR à valider"
            value={stats?.cr_soumis}
            loading={loading}
            href="/comptes-rendus?statut=soumis"
            meta={`${stats?.cr_brouillons ?? 0} brouillons`}
            accent={(stats?.cr_soumis ?? 0) > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={FileText}
            title="CR validés ce mois"
            value={stats?.cr_valides_mois}
            loading={loading}
            href="/comptes-rendus"
            meta={
              stats?.taux_validation_mois != null
                ? `Taux validation ${stats.taux_validation_mois} %`
                : `${stats?.cr_crees_mois ?? 0} créés`
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={CheckSquare}
            title="Actions ouvertes"
            value={stats?.actions_ouvertes}
            loading={loading}
            href="/actions"
            meta={
              stats?.actions_en_retard
                ? `${stats.actions_en_retard} en retard`
                : 'Suivi global'
            }
            accent={(stats?.actions_en_retard ?? 0) > 0}
          />
        </StaggerItem>
      </StaggerList>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-ogefrem-blue" aria-hidden />
                Réunions par semaine — {stats.mois_libelle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.reunions_par_semaine.map((s) => (
                <BarRow
                  key={s.semaine}
                  label={s.libelle}
                  value={s.count}
                  max={maxSemaine}
                  color="bg-ogefrem-blue"
                  href={lienMois}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-ogefrem-blue" aria-hidden />
                Statuts du mois — {stats.mois_libelle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                Object.entries(stats.reunions_par_statut_mois) as [
                  keyof typeof stats.reunions_par_statut_mois,
                  number,
                ][]
              )
                .filter(([, count]) => count > 0)
                .map(([statut, count]) => (
                  <BarRow
                    key={statut}
                    label={LIBELLES_STATUT[statut] ?? statut}
                    value={count}
                    max={maxStatutMois}
                    color={COULEURS_STATUT[statut] ?? 'bg-ogefrem-blue/70'}
                    href={lienReunionsFiltrees({
                      statut,
                      date_debut: plage.date_debut,
                      date_fin: plage.date_fin,
                    })}
                  />
                ))}
              {Object.values(stats.reunions_par_statut_mois).every((c) => c === 0) && (
                <p className="text-sm text-text-muted">Aucune réunion ce mois.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-ogefrem-blue" aria-hidden />
                Réunions par direction — {stats.mois_libelle}
              </CardTitle>
              <Link
                to={lienMois}
                className="text-xs font-semibold text-ogefrem-blue hover:underline"
              >
                Toutes les réunions
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.reunions_par_direction.length === 0 && (
                <p className="text-sm text-text-muted">
                  Aucune réunion rattachée à une direction ce mois.
                </p>
              )}
              {stats.reunions_par_direction.map((d) => (
                <BarRow
                  key={d.direction_id}
                  label={d.code ? `${d.code} — ${d.nom}` : d.nom}
                  value={d.count}
                  max={maxDirection}
                  color="bg-ogefrem-blue/80"
                  href={lienReunionsFiltrees({
                    direction_id: d.direction_id,
                    date_debut: plage.date_debut,
                    date_fin: plage.date_fin,
                  })}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReunionsListCard
          title="Dernières réunions créées"
          href="/reunions"
          loading={reunionsRecentesQuery.isLoading}
          reunions={reunionsRecentesQuery.data?.items ?? []}
        />
        <ReunionsListCard
          title="Réunions à valider"
          href={lienReunionsFiltrees({ statut: 'en_attente_validation' })}
          loading={reunionsAValiderQuery.isLoading}
          reunions={reunionsAValiderQuery.data?.items ?? []}
          emptyLabel="Aucune réunion en attente de validation."
        />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text">Raccourcis administration</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/administration?tab=utilisateurs">
            <Button size="sm" variant="outline">
              <Users className="h-4 w-4" aria-hidden />
              Utilisateurs
            </Button>
          </Link>
          <Link to="/administration?tab=directions">
            <Button size="sm" variant="outline">
              <Building2 className="h-4 w-4" aria-hidden />
              Directions
            </Button>
          </Link>
          <Link to="/reunions/nouvelle">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden />
              Créer une réunion
            </Button>
          </Link>
          <Link to="/reunions">
            <Button size="sm" variant="outline">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Toutes les réunions
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}

function ReunionsListCard({
  title,
  href,
  loading,
  reunions,
  emptyLabel = 'Aucune réunion.',
}: {
  title: string;
  href: string;
  loading: boolean;
  reunions: Reunion[];
  emptyLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link to={href} className="text-xs font-semibold text-ogefrem-blue hover:underline">
          Tout voir
        </Link>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-text-muted">Chargement…</p>}
        {!loading && reunions.length === 0 && (
          <p className="text-sm text-text-muted">{emptyLabel}</p>
        )}
        {reunions.length > 0 && (
          <ul className="divide-y divide-border">
            {reunions.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    to={`/reunions/${r.id}`}
                    className="block truncate font-medium text-ogefrem-blue hover:underline"
                  >
                    {r.titre}
                  </Link>
                  <p className="text-xs text-text-muted">
                    {formatDateHeure(r.date_prevue)}
                    {r.lieu ? ` · ${r.lieu}` : ''}
                  </p>
                </div>
                <Badge variant="neutral">{LIBELLES_STATUT[r.statut]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
