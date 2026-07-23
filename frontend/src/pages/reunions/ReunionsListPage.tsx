import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ReunionCalendar } from '@/components/reunions/ReunionCalendar';
import {
  FILTRES_VIDES,
  ReunionFilters,
  type ReunionFiltersState,
} from '@/components/reunions/ReunionFilters';
import { ReunionPagination } from '@/components/reunions/ReunionPagination';
import { ReunionTable } from '@/components/reunions/ReunionTable';
import { Button } from '@/components/ui/Button';
import { debutJourneeISO, finJourneeISO } from '@/lib/labels';
import { peutCreerReunionRole } from '@/lib/roles';
import {
  archiverReunion,
  demarrerReunion,
  listerDirections,
  listerProfils,
  listerReunions,
} from '@/lib/reunions-api';
import { useAuthStore } from '@/stores/auth.store';
import type { Direction, Profil, StatutReunion, TypeReunion } from '@ogefmeeting/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, LayoutList, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type VueMode = 'tableau' | 'calendrier';

function startOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).toISOString();
}

function endOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

export function ReunionsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const announce = useAnnouncerStore((s) => s.announce);
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const peutCreer = peutCreerReunionRole(role, profil?.fonction);

  const [vue, setVue] = useState<VueMode>('tableau');
  const [filtres, setFiltres] = useState<ReunionFiltersState>(FILTRES_VIDES);
  const [rechercheDebounced, setRechercheDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [moisCalendrier] = useState(() => new Date());

  useEffect(() => {
    const t = window.setTimeout(() => setRechercheDebounced(filtres.recherche.trim()), 300);
    return () => window.clearTimeout(t);
  }, [filtres.recherche]);

  useEffect(() => {
    setPage(1);
  }, [
    rechercheDebounced,
    filtres.statut,
    filtres.type_reunion,
    filtres.direction_id,
    filtres.participant_id,
    filtres.date_debut,
    filtres.date_fin,
    filtres.tri,
    filtres.ordre,
    vue,
  ]);

  const queryParams = useMemo(() => {
    const base = {
      page: vue === 'calendrier' ? 1 : page,
      limite: vue === 'calendrier' ? 100 : 10,
      tri: filtres.tri,
      ordre: filtres.ordre,
      recherche: rechercheDebounced || undefined,
      statut: (filtres.statut || undefined) as StatutReunion | undefined,
      type_reunion: (filtres.type_reunion || undefined) as TypeReunion | undefined,
      direction_id: filtres.direction_id || undefined,
      participant_id: filtres.participant_id || undefined,
      date_apres: filtres.date_debut
        ? debutJourneeISO(filtres.date_debut)
        : vue === 'calendrier'
          ? startOfMonthISO(moisCalendrier)
          : undefined,
      date_avant: filtres.date_fin
        ? finJourneeISO(filtres.date_fin)
        : vue === 'calendrier'
          ? endOfMonthISO(moisCalendrier)
          : undefined,
    };
    return base;
  }, [filtres, page, rechercheDebounced, vue, moisCalendrier]);

  const reunionsQuery = useQuery({
    queryKey: ['reunions', queryParams],
    queryFn: () => listerReunions(queryParams),
  });

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirections,
  });

  const profilsQuery = useQuery({
    queryKey: ['profils', 'filtre-reunions'],
    queryFn: () => listerProfils({ limite: 100 }),
  });

  const directions: Direction[] = directionsQuery.data ?? [];
  const profils: Profil[] = profilsQuery.data?.items ?? [];

  async function handleDemarrer(id: string) {
    setActionLoadingId(id);
    try {
      await demarrerReunion(id);
      announce('Réunion démarrée. Passage en mode live.');
      await queryClient.invalidateQueries({ queryKey: ['reunions'] });
      navigate(`/reunions/${id}/live`);
    } catch (err) {
      announce(err instanceof Error ? err.message : 'Impossible de démarrer.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleArchiver(id: string) {
    const ok = window.confirm('Archiver cette réunion ? Elle disparaîtra de la liste active.');
    if (!ok) return;

    setActionLoadingId(id);
    try {
      await archiverReunion(id);
      announce('Réunion archivée.');
      await queryClient.invalidateQueries({ queryKey: ['reunions'] });
    } catch (err) {
      announce(err instanceof Error ? err.message : 'Impossible d’archiver.');
    } finally {
      setActionLoadingId(null);
    }
  }

  const data = reunionsQuery.data;
  const reunions = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumbs items={[{ label: 'Réunions' }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-text sm:text-2xl">Réunions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex flex-1 rounded-lg border border-border bg-surface p-1 sm:flex-none"
            role="group"
            aria-label="Mode d'affichage"
          >
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-none"
              variant={vue === 'tableau' ? 'primary' : 'ghost'}
              aria-pressed={vue === 'tableau'}
              onClick={() => setVue('tableau')}
            >
              <LayoutList className="h-4 w-4" aria-hidden />
              Liste
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-none"
              variant={vue === 'calendrier' ? 'primary' : 'ghost'}
              aria-pressed={vue === 'calendrier'}
              onClick={() => setVue('calendrier')}
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              Calendrier
            </Button>
          </div>
          {peutCreer && (
            <Link to="/reunions/nouvelle" className="min-w-0 flex-1 sm:flex-none">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" aria-hidden />
                Nouvelle
              </Button>
            </Link>
          )}
        </div>
      </div>

      <ReunionFilters
        value={filtres}
        onChange={setFiltres}
        directions={directions}
        profils={profils}
      />

      {reunionsQuery.isLoading && (
        <div
          className="rounded-xl border border-border bg-surface p-10 text-center text-text-muted"
          role="status"
        >
          Chargement des réunions…
        </div>
      )}

      {reunionsQuery.isError && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-danger" role="alert">
          {reunionsQuery.error instanceof Error
            ? reunionsQuery.error.message
            : 'Impossible de charger les réunions.'}
        </div>
      )}

      {reunionsQuery.isSuccess && reunions.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <h3 className="text-lg font-semibold text-text">Aucune réunion</h3>
          <p className="mt-2 text-sm text-text-muted">
            {peutCreer
              ? 'Modifiez les filtres ou créez une nouvelle réunion.'
              : 'Vous voyez vos invitations et vos propositions (en attente ou planifiées).'}
          </p>
          {peutCreer && (
            <Link to="/reunions/nouvelle" className="mt-4 inline-block">
              <Button>
                <Plus className="h-4 w-4" aria-hidden />
                Nouvelle réunion
              </Button>
            </Link>
          )}
        </div>
      )}

      {reunionsQuery.isSuccess && reunions.length > 0 && vue === 'tableau' && (
        <>
          <ReunionTable
            reunions={reunions}
            onDemarrer={(id) => void handleDemarrer(id)}
            onArchiver={(id) => void handleArchiver(id)}
            actionLoadingId={actionLoadingId}
          />
          {pagination && (
            <ReunionPagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {reunionsQuery.isSuccess && reunions.length > 0 && vue === 'calendrier' && (
        <ReunionCalendar reunions={reunions} />
      )}
    </div>
  );
}
