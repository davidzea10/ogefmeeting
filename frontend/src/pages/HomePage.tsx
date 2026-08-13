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
import {
  LIBELLES_FONCTION,
  LIBELLES_ROLE,
  peutApprouverReunionRole,
  peutCreerReunionRole,
  peutValiderCrRole,
} from '@/lib/roles';
import { listerReunions, obtenirReunion } from '@/lib/reunions-api';
import { useAuthStore } from '@/stores/auth.store';
import type { DashboardResume, FonctionOrganisation, Reunion } from '@ogefmeeting/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  Mail,
  Plus,
  Send,
  UserPlus,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export function HomePage() {
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const peutCreer = peutCreerReunionRole(role, profil?.fonction);
  const estValidateur = peutApprouverReunionRole(role, profil?.fonction);
  const profilId = profil?.id;

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'resume', profilId, estValidateur ? 'staff' : 'agent'],
    queryFn: () => obtenirDashboardResume(profilId),
  });

  const reunionsAVenirQuery = useQuery({
    queryKey: ['dashboard', 'reunions-avenir', estValidateur ? 'staff' : 'agent'],
    queryFn: () =>
      listerReunions({
        page: 1,
        limite: 8,
        statut: 'planifiee',
        date_apres: new Date().toISOString(),
        tri: 'date_prevue',
        ordre: 'asc',
      }),
  });

  const mesPropositionsQuery = useQuery({
    queryKey: ['dashboard', 'mes-propositions'],
    queryFn: () =>
      listerReunions({
        page: 1,
        limite: 8,
        statut: 'en_attente_validation',
        tri: 'date_prevue',
        ordre: 'asc',
      }),
    enabled: Boolean(profilId) && !estValidateur,
  });

  const reunionsAValiderQuery = useQuery({
    queryKey: ['dashboard', 'reunions-a-valider'],
    queryFn: () =>
      listerReunions({
        page: 1,
        limite: 5,
        statut: 'en_attente_validation',
        tri: 'cree_le',
        ordre: 'desc',
      }),
    enabled: estValidateur,
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

  /** Agent : invitations à confirmer (participant invite, hors créateur) */
  const candidatsInvitation = useMemo(() => {
    if (estValidateur || !profilId) return [] as Reunion[];
    const aVenir = reunionsAVenirQuery.data?.items ?? [];
    const propositions = mesPropositionsQuery.data?.items ?? [];
    const map = new Map<string, Reunion>();
    for (const r of [...aVenir, ...propositions]) map.set(r.id, r);
    return [...map.values()].filter((r) => r.cree_par !== profilId).slice(0, 6);
  }, [
    estValidateur,
    profilId,
    reunionsAVenirQuery.data,
    mesPropositionsQuery.data,
  ]);

  const invitationDetails = useQueries({
    queries: candidatsInvitation.map((r) => ({
      queryKey: ['reunion', 'invitation-check', r.id],
      queryFn: () => obtenirReunion(r.id),
      enabled: !estValidateur && candidatsInvitation.length > 0,
    })),
  });

  const invitationsAConfirmer = useMemo(() => {
    if (!profilId || estValidateur) return [] as Reunion[];
    return invitationDetails
      .map((q) => q.data)
      .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
      .filter((detail) => {
        const moi = detail.participants.find((p) => p.profil_id === profilId);
        return moi?.statut === 'invite';
      });
  }, [invitationDetails, profilId, estValidateur]);

  const stats = dashboardQuery.data;
  const greeting = profil
    ? `Bonjour ${profil.prenom}`
    : 'Bienvenue sur Ogefmeeting';

  const fonctionLabel =
    profil?.fonction &&
    (profil.fonction as FonctionOrganisation) in LIBELLES_FONCTION
      ? LIBELLES_FONCTION[profil.fonction as FonctionOrganisation]
      : null;

  const mesActionsOuvertes =
    mesActionsQuery.data?.items.filter(
      (a) => a.statut === 'en_attente' || a.statut === 'en_cours' || a.statut === 'en_retard',
    ) ?? [];

  const mesReunionsOrganisees =
    mesPropositionsQuery.data?.items.filter((r) => r.cree_par === profilId) ??
    [];

  const invitationsLoading =
    !estValidateur &&
    (reunionsAVenirQuery.isLoading ||
      mesPropositionsQuery.isLoading ||
      invitationDetails.some((q) => q.isLoading));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumbs items={[{ label: 'Tableau de bord' }]} />

      <section className="relative overflow-hidden rounded-2xl gradient-ogefrem p-6 text-white shadow-lg sm:p-8">
        <img
          src="/brand/arriere-plan.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {role && (
                <Badge variant="yellow" className="border-0">
                  {LIBELLES_ROLE[role]}
                </Badge>
              )}
              {fonctionLabel && (
                <Badge variant="yellow" className="border-0 bg-white/20 text-white">
                  {fonctionLabel}
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">{greeting}</h2>
            <p className="max-w-2xl text-sm text-white/85 sm:text-base">
              {estValidateur
                ? `Vue direction / secrétariat${stats ? ` — ${stats.mois_libelle}` : ''}.`
                : 'Votre espace personnel : réunions où vous êtes invité(e) ou que vous organisez.'}
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
              <Button
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                Voir mes réunions
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {estValidateur ? (
        <StaffDashboard
          stats={stats}
          loading={dashboardQuery.isLoading}
          reunionsAVenirQuery={reunionsAVenirQuery}
          reunionsAValiderQuery={reunionsAValiderQuery}
          crSoumisQuery={crSoumisQuery}
          mesActionsOuvertes={mesActionsOuvertes}
          mesActionsLoading={mesActionsQuery.isLoading}
          peutValiderCr={peutValiderCrRole(role)}
          peutCreer={peutCreer}
        />
      ) : (
        <AgentDashboard
          stats={stats}
          loading={dashboardQuery.isLoading}
          reunionsAVenir={reunionsAVenirQuery.data?.items ?? []}
          reunionsAVenirLoading={reunionsAVenirQuery.isLoading}
          mesReunionsOrganisees={mesReunionsOrganisees}
          propositionsLoading={mesPropositionsQuery.isLoading}
          invitationsAConfirmer={invitationsAConfirmer}
          invitationsLoading={invitationsLoading}
          mesActionsOuvertes={mesActionsOuvertes}
          mesActionsLoading={mesActionsQuery.isLoading}
          peutCreer={peutCreer}
        />
      )}
    </div>
  );
}

function AgentDashboard({
  stats,
  loading,
  reunionsAVenir,
  reunionsAVenirLoading,
  mesReunionsOrganisees,
  propositionsLoading,
  invitationsAConfirmer,
  invitationsLoading,
  mesActionsOuvertes,
  mesActionsLoading,
  peutCreer,
}: {
  stats: DashboardResume | undefined;
  loading?: boolean;
  reunionsAVenir: Reunion[];
  reunionsAVenirLoading: boolean;
  mesReunionsOrganisees: Reunion[];
  propositionsLoading: boolean;
  invitationsAConfirmer: Reunion[];
  invitationsLoading: boolean;
  mesActionsOuvertes: {
    id: string;
    titre: string;
    statut: string;
    date_echeance: string | null;
    compte_rendu_id: string | null;
  }[];
  mesActionsLoading: boolean;
  peutCreer: boolean;
}) {
  return (
    <>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            icon={CalendarDays}
            title="Mes réunions à venir"
            value={stats?.reunions_a_venir}
            loading={loading}
            href="/reunions"
            meta={
              stats?.reunions_en_cours
                ? `${stats.reunions_en_cours} en cours`
                : 'Planifiées / invitées'
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={Mail}
            title="Invitations à confirmer"
            value={invitationsAConfirmer.length}
            loading={invitationsLoading}
            href="/notifications"
            meta="Présence à confirmer"
            accent={invitationsAConfirmer.length > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={UserPlus}
            title="Mes propositions"
            value={mesReunionsOrganisees.length}
            loading={propositionsLoading}
            href="/reunions"
            meta="En attente de validation"
            accent={mesReunionsOrganisees.length > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={CheckSquare}
            title="Mes actions"
            value={stats?.mes_actions_ouvertes}
            loading={loading}
            href="/actions"
            meta="Assignées à moi"
            accent={(stats?.mes_actions_ouvertes ?? 0) > 0}
          />
        </StaggerItem>
      </StaggerList>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Mes prochaines réunions</CardTitle>
            <Link to="/reunions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent>
            {reunionsAVenirLoading && (
              <p className="text-sm text-text-muted">Chargement…</p>
            )}
            {!reunionsAVenirLoading && reunionsAVenir.length === 0 && (
              <p className="text-sm text-text-muted">
                Aucune réunion planifiée à venir pour vous.
              </p>
            )}
            {reunionsAVenir.length > 0 && (
              <ul className="divide-y divide-border">
                {reunionsAVenir.slice(0, 5).map((r) => (
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Invitations à confirmer</CardTitle>
            <Link
              to="/notifications"
              className="text-xs font-semibold text-ogefrem-blue hover:underline"
            >
              Notifications
            </Link>
          </CardHeader>
          <CardContent>
            {invitationsLoading && (
              <p className="text-sm text-text-muted">Chargement…</p>
            )}
            {!invitationsLoading && invitationsAConfirmer.length === 0 && (
              <p className="text-sm text-text-muted">Aucune invitation en attente.</p>
            )}
            {invitationsAConfirmer.length > 0 && (
              <ul className="divide-y divide-border">
                {invitationsAConfirmer.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        to={`/reunions/${r.id}/invitation`}
                        className="block truncate font-medium text-ogefrem-blue hover:underline"
                      >
                        {r.titre}
                      </Link>
                      <p className="text-xs text-text-muted">
                        {formatDateHeure(r.date_prevue)}
                      </p>
                    </div>
                    <Link to={`/reunions/${r.id}/invitation`}>
                      <Button size="sm" variant="secondary">
                        Confirmer
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Réunions que j’organise</CardTitle>
            <Link to="/reunions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent>
            {propositionsLoading && (
              <p className="text-sm text-text-muted">Chargement…</p>
            )}
            {!propositionsLoading && mesReunionsOrganisees.length === 0 && (
              <p className="text-sm text-text-muted">
                Aucune proposition en attente de validation.
              </p>
            )}
            {mesReunionsOrganisees.length > 0 && (
              <ul className="divide-y divide-border">
                {mesReunionsOrganisees.map((r) => (
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
                      </p>
                    </div>
                    <Badge variant="warning">{LIBELLES_STATUT[r.statut]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Mes actions assignées</CardTitle>
            <Link to="/actions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
              Toutes
            </Link>
          </CardHeader>
          <CardContent>
            {mesActionsLoading && (
              <p className="text-sm text-text-muted">Chargement…</p>
            )}
            {!mesActionsLoading && mesActionsOuvertes.length === 0 && (
              <p className="text-sm text-text-muted">
                Aucune action ouverte qui vous est assignée.
              </p>
            )}
            {mesActionsOuvertes.length > 0 && (
              <ul className="divide-y divide-border">
                {mesActionsOuvertes.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{a.titre}</p>
                      <p className="text-xs text-text-muted">
                        {a.date_echeance ? `Échéance ${a.date_echeance}` : 'Sans échéance'}
                      </p>
                    </div>
                    <Badge variant={a.statut === 'en_retard' ? 'danger' : 'neutral'}>
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
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text">Raccourcis</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/reunions">
            <Button size="sm" variant="outline">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Mes réunions
            </Button>
          </Link>
          <Link to="/notifications">
            <Button size="sm" variant="outline">
              <Mail className="h-4 w-4" aria-hidden />
              Notifications
            </Button>
          </Link>
          <Link to="/profil">
            <Button size="sm" variant="outline">
              Mon profil
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
    </>
  );
}

function StaffDashboard({
  stats,
  loading,
  reunionsAVenirQuery,
  reunionsAValiderQuery,
  crSoumisQuery,
  mesActionsOuvertes,
  mesActionsLoading,
  peutValiderCr,
  peutCreer,
}: {
  stats: DashboardResume | undefined;
  loading?: boolean;
  reunionsAVenirQuery: {
    isLoading: boolean;
    isSuccess: boolean;
    data?: { items: Reunion[] };
  };
  reunionsAValiderQuery: {
    isLoading: boolean;
    isSuccess: boolean;
    data?: { items: Reunion[] };
  };
  crSoumisQuery: {
    isLoading: boolean;
    isSuccess: boolean;
    data?: {
      items: {
        id: string;
        version: number;
        soumis_le: string | null;
      }[];
    };
  };
  mesActionsOuvertes: { id: string; titre: string; statut: string }[];
  mesActionsLoading: boolean;
  peutValiderCr: boolean;
  peutCreer: boolean;
}) {
  return (
    <>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            icon={CalendarDays}
            title="Réunions à venir"
            value={stats?.reunions_a_venir}
            loading={loading}
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
            title={peutValiderCr ? 'CR à valider' : 'Brouillons CR'}
            value={peutValiderCr ? stats?.cr_soumis : stats?.cr_brouillons}
            loading={loading}
            href="/comptes-rendus"
            meta={peutValiderCr ? 'Soumis' : 'À compléter'}
            accent={peutValiderCr && (stats?.cr_soumis ?? 0) > 0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={CheckSquare}
            title="Mes actions"
            value={stats?.mes_actions_ouvertes}
            loading={loading}
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
            loading={loading}
            href="/reunions"
            meta={
              stats?.taux_validation_mois != null
                ? `Taux validation CR ${stats.taux_validation_mois} %`
                : `${stats?.cr_valides_mois ?? 0} CR validés`
            }
          />
        </StaggerItem>
      </StaggerList>

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
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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
            {reunionsAVenirQuery.isSuccess && (reunionsAVenirQuery.data?.items.length ?? 0) === 0 && (
              <p className="text-sm text-text-muted">Aucune réunion planifiée à venir.</p>
            )}
            {reunionsAVenirQuery.isSuccess && (reunionsAVenirQuery.data?.items.length ?? 0) > 0 && (
              <ul className="divide-y divide-border">
                {(reunionsAVenirQuery.data?.items ?? []).slice(0, 5).map((r) => (
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Réunions à valider</CardTitle>
            <Link to="/reunions" className="text-xs font-semibold text-ogefrem-blue hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent>
            {reunionsAValiderQuery.isLoading && (
              <p className="text-sm text-text-muted">Chargement…</p>
            )}
            {reunionsAValiderQuery.isSuccess &&
              (reunionsAValiderQuery.data?.items.length ?? 0) === 0 && (
                <p className="text-sm text-text-muted">Aucune réunion en attente.</p>
              )}
            {reunionsAValiderQuery.isSuccess &&
              (reunionsAValiderQuery.data?.items.length ?? 0) > 0 && (
                <ul className="divide-y divide-border">
                  {(reunionsAValiderQuery.data?.items ?? []).map((r) => (
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
                        </p>
                      </div>
                      <Badge variant="warning">{LIBELLES_STATUT[r.statut]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>

        {peutValiderCr ? (
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
              {crSoumisQuery.isSuccess && (crSoumisQuery.data?.items.length ?? 0) === 0 && (
                <p className="text-sm text-text-muted">Aucun compte rendu soumis.</p>
              )}
              {crSoumisQuery.isSuccess && (crSoumisQuery.data?.items.length ?? 0) > 0 && (
                <ul className="divide-y divide-border">
                  {(crSoumisQuery.data?.items ?? []).map((cr) => (
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
              {mesActionsLoading && (
                <p className="text-sm text-text-muted">Chargement…</p>
              )}
              {!mesActionsLoading && mesActionsOuvertes.length === 0 && (
                <p className="text-sm text-text-muted">Aucune action ouverte.</p>
              )}
              {mesActionsOuvertes.length > 0 && (
                <ul className="divide-y divide-border">
                  {mesActionsOuvertes.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 py-2">
                      <span className="font-medium text-text">{a.titre}</span>
                      <Badge variant="neutral">{a.statut}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {peutValiderCr && mesActionsOuvertes.length > 0 && (
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
    </>
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
