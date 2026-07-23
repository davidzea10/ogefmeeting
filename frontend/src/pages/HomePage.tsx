import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { StaggerItem, StaggerList } from '@/components/motion/StaggerList';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { listerActions } from '@/lib/actions-decisions-api';
import { listerComptesRendus } from '@/lib/comptes-rendus-api';
import { obtenirDashboardResume } from '@/lib/dashboard-api';
import {
  formatDateCourte,
  formatDateHeure,
  LIBELLES_STATUT,
} from '@/lib/labels';
import { LIBELLES_ROLE, peutCreerReunionRole, peutValiderCrRole } from '@/lib/roles';
import { listerReunions } from '@/lib/reunions-api';
import { useAuthStore } from '@/stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  Plus,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomePage() {
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const peutCreer = peutCreerReunionRole(role, profil?.fonction);
  const profilId = profil?.id;

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'resume', profilId],
    queryFn: () => obtenirDashboardResume(profilId),
  });

  const reunionsAVenirQuery = useQuery({
    queryKey: ['dashboard', 'reunions-avenir'],
    queryFn: () =>
      listerReunions({
        page: 1,
        limite: 5,
        statut: 'planifiee',
        date_apres: new Date().toISOString(),
        tri: 'date_prevue',
        ordre: 'asc',
      }),
  });

  const crSoumisQuery = useQuery({
    queryKey: ['dashboard', 'cr-soumis'],
    queryFn: () => listerComptesRendus({ statut: 'soumis', page: 1, limite: 5 }),
    enabled: peutValiderCrRole(role),
  });

  const mesActionsQuery = useQuery({
    queryKey: ['dashboard', 'mes-actions', profilId],
    queryFn: () =>
      listerActions({
        responsable_id: profilId!,
        page: 1,
        limite: 5,
      }),
    enabled: Boolean(profilId),
  });

  const stats = dashboardQuery.data;
  const greeting = profil
    ? `Bonjour ${profil.prenom}`
    : 'Bienvenue sur Ogefmeeting';

  const mesActionsOuvertes =
    mesActionsQuery.data?.items.filter(
      (a) => a.statut === 'en_attente' || a.statut === 'en_cours' || a.statut === 'en_retard',
    ) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumbs items={[{ label: 'Tableau de bord' }]} />

      {/* Bienvenue */}
      <section className="relative overflow-hidden rounded-2xl gradient-ogefrem p-6 text-white shadow-lg sm:p-8">
        <img
          src="/brand/arriere-plan.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            {role && (
              <Badge variant="yellow" className="border-0">
                {LIBELLES_ROLE[role]}
              </Badge>
            )}
            <h2 className="text-2xl font-bold sm:text-3xl">{greeting}</h2>
            <p className="max-w-2xl text-sm text-white/85 sm:text-base">
              Voici votre vue personnalisée
              {stats ? ` — ${stats.mois_libelle}` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {peutCreer && (
              <Link to="/reunions/nouvelle">
                <Button className="bg-ogefrem-yellow text-ogefrem-navy hover:bg-ogefrem-yellow-light">
                  <Plus className="h-4 w-4" aria-hidden />
                  Nouvelle réunion
                </Button>
              </Link>
            )}
            <Link to="/reunions">
              <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                Voir les réunions
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            icon={CalendarDays}
            title="Réunions à venir"
            value={stats?.reunions_a_venir}
            loading={dashboardQuery.isLoading}
            href="/reunions"
            meta={
              stats?.reunions_en_cours
                ? `${stats.reunions_en_cours} en cours`
                : 'Planifiées'
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={FileText}
            title={peutValiderCrRole(role) ? 'CR à valider' : 'Brouillons CR'}
            value={peutValiderCrRole(role) ? stats?.cr_soumis : stats?.cr_brouillons}
            loading={dashboardQuery.isLoading}
            href="/comptes-rendus"
            meta={peutValiderCrRole(role) ? 'Soumis' : 'À compléter'}
            accent={peutValiderCrRole(role) && (stats?.cr_soumis ?? 0) > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={CheckSquare}
            title="Mes actions"
            value={stats?.mes_actions_ouvertes}
            loading={dashboardQuery.isLoading}
            href="/actions"
            meta={
              stats?.actions_en_retard
                ? `${stats.actions_en_retard} en retard (global)`
                : 'Ouvertes'
            }
            accent={(stats?.mes_actions_ouvertes ?? 0) > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={ClipboardList}
            title={`Réunions — ${stats?.mois_libelle ?? 'ce mois'}`}
            value={stats?.reunions_mois}
            loading={dashboardQuery.isLoading}
            href="/reunions"
            meta={
              stats?.taux_validation_mois != null
                ? `Taux validation CR ${stats.taux_validation_mois} %`
                : `${stats?.cr_valides_mois ?? 0} CR validés`
            }
          />
        </StaggerItem>
      </StaggerList>

      {/* Graphique simple mois */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Indicateurs du mois</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarRow
              label="Réunions ce mois"
              value={stats.reunions_mois}
              max={Math.max(stats.reunions_mois, 5)}
              color="bg-ogefrem-blue"
            />
            <BarRow
              label="CR créés"
              value={stats.cr_crees_mois}
              max={Math.max(stats.cr_crees_mois, stats.cr_valides_mois, 5)}
              color="bg-ogefrem-blue/70"
            />
            <BarRow
              label="CR validés"
              value={stats.cr_valides_mois}
              max={Math.max(stats.cr_crees_mois, stats.cr_valides_mois, 5)}
              color="bg-success"
            />
            <BarRow
              label="Actions ouvertes"
              value={stats.actions_ouvertes}
              max={Math.max(stats.actions_ouvertes, 5)}
              color="bg-warning"
            />
            {stats.taux_validation_mois != null && (
              <p className="text-sm text-text-muted">
                Taux de validation ce mois :{' '}
                <strong className="text-text">{stats.taux_validation_mois} %</strong>
                {' '}({stats.cr_valides_mois}/{stats.cr_crees_mois})
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Prochaines réunions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Prochaines réunions</CardTitle>
            <Link to="/reunions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent>
            {reunionsAVenirQuery.isLoading && (
              <p className="text-sm text-text-muted">Chargement…</p>
            )}
            {reunionsAVenirQuery.isSuccess && reunionsAVenirQuery.data.items.length === 0 && (
              <p className="text-sm text-text-muted">Aucune réunion planifiée à venir.</p>
            )}
            {reunionsAVenirQuery.isSuccess && reunionsAVenirQuery.data.items.length > 0 && (
              <ul className="divide-y divide-border">
                {reunionsAVenirQuery.data.items.map((r) => (
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

        {/* CR à valider OU mes actions */}
        {peutValiderCrRole(role) ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-ogefrem-blue" aria-hidden />
                CR en attente de validation
              </CardTitle>
              <Link
                to="/comptes-rendus"
                className="text-xs font-semibold text-ogefrem-blue hover:underline"
              >
                Liste CR
              </Link>
            </CardHeader>
            <CardContent>
              {crSoumisQuery.isLoading && (
                <p className="text-sm text-text-muted">Chargement…</p>
              )}
              {crSoumisQuery.isSuccess && crSoumisQuery.data.items.length === 0 && (
                <p className="text-sm text-text-muted">Aucun compte rendu soumis.</p>
              )}
              {crSoumisQuery.isSuccess && crSoumisQuery.data.items.length > 0 && (
                <ul className="divide-y divide-border">
                  {crSoumisQuery.data.items.map((cr) => (
                    <li key={cr.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link
                          to={`/comptes-rendus/${cr.id}`}
                          className="font-medium text-ogefrem-blue hover:underline"
                        >
                          Compte rendu v{cr.version}
                        </Link>
                        <p className="text-xs text-text-muted">
                          Soumis
                          {cr.soumis_le ? ` le ${formatDateCourte(cr.soumis_le)}` : ''}
                        </p>
                      </div>
                      <Badge variant="warning">Soumis</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Mes actions assignées</CardTitle>
              <Link to="/actions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
                Toutes
              </Link>
            </CardHeader>
            <CardContent>
              {mesActionsQuery.isLoading && (
                <p className="text-sm text-text-muted">Chargement…</p>
              )}
              {mesActionsQuery.isSuccess && mesActionsOuvertes.length === 0 && (
                <p className="text-sm text-text-muted">Aucune action ouverte qui vous est assignée.</p>
              )}
              {mesActionsOuvertes.length > 0 && (
                <ul className="divide-y divide-border">
                  {mesActionsOuvertes.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{a.titre}</p>
                        <p className="text-xs text-text-muted">
                          {a.date_echeance ? `Échéance ${a.date_echeance}` : 'Sans échéance'}
                          {a.compte_rendu_id ? (
                            <>
                              {' · '}
                              <Link
                                to={`/comptes-rendus/${a.compte_rendu_id}`}
                                className="text-ogefrem-blue hover:underline"
                              >
                                CR
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <Badge
                        variant={a.statut === 'en_retard' ? 'danger' : 'neutral'}
                      >
                        {a.statut === 'en_retard' ? (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Retard
                          </span>
                        ) : (
                          a.statut
                        )}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pour directeur : aussi mes actions en dessous si présentes */}
      {peutValiderCrRole(role) && mesActionsOuvertes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Mes actions assignées</CardTitle>
            <Link to="/actions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
              Toutes
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {mesActionsOuvertes.slice(0, 5).map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-2">
                  <span className="font-medium text-text">{a.titre}</span>
                  <Badge variant="neutral">{a.statut}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Raccourcis */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text">Raccourcis</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/reunions">
            <Button size="sm" variant="outline">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Réunions
            </Button>
          </Link>
          <Link to="/comptes-rendus">
            <Button size="sm" variant="outline">
              <FileText className="h-4 w-4" aria-hidden />
              Comptes rendus
            </Button>
          </Link>
          <Link to="/actions">
            <Button size="sm" variant="outline">
              <CheckSquare className="h-4 w-4" aria-hidden />
              Actions
            </Button>
          </Link>
          {peutCreer && (
            <Link to="/reunions/nouvelle">
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden />
                Créer une réunion
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  meta,
  loading,
  href,
  accent,
}: {
  icon: typeof CalendarDays;
  title: string;
  value: number | undefined;
  meta: string;
  loading?: boolean;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link to={href} className="block">
      <Card className={accent ? 'border-ogefrem-blue/40 ring-1 ring-ogefrem-blue/20' : ''}>
        <CardContent className="flex items-start gap-3 pt-5">
          <div className="rounded-lg bg-ogefrem-blue/10 p-2.5 text-ogefrem-blue">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-muted">{title}</p>
            <p className="text-2xl font-bold text-text">
              {loading ? '…' : (value ?? '—')}
            </p>
            <p className="truncate text-xs text-text-muted">{meta}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span className="font-semibold text-text">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
          role="img"
          aria-label={`${label} : ${value}`}
        />
      </div>
    </div>
  );
}
