import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateHeure } from '@/lib/labels';
import {
  listerNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
} from '@/lib/notifications-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const LIBELLE_TYPE: Record<string, string> = {
  invitation_reunion: 'Invitation',
  reunion_approuvee: 'Réunion approuvée',
  reunion_refusee: 'Réunion refusée',
  cr_a_valider: 'CR à valider',
  cr_soumis: 'CR soumis',
  cr_en_revision: 'CR en révision',
  cr_publie: 'CR publié',
  cr_valide: 'CR validé',
  cr_archive: 'CR archivé',
  action_en_retard: 'Action en retard',
};

export function NotificationsPage() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const [filtre, setFiltre] = useState<'toutes' | 'non_lues'>('toutes');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['notifications', 'page', { filtre, page }],
    queryFn: () =>
      listerNotifications({
        page,
        limite: 30,
        non_lues: filtre === 'non_lues' ? true : undefined,
      }),
  });

  const lireMut = useMutation({
    mutationFn: (id: string) => marquerNotificationLue(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const toutLireMut = useMutation({
    mutationFn: () => marquerToutesNotificationsLues(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      announce('Toutes les notifications sont marquées comme lues.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const nonLues = query.data?.items.filter((n) => !n.est_lu).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Breadcrumbs items={[{ label: 'Notifications' }]} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-text">
            <Bell className="h-6 w-6 text-ogefrem-blue" aria-hidden />
            Notifications
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Invitations, validations CR, actions en retard, etc.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={toutLireMut.isPending}
          disabled={!query.data?.items.some((n) => !n.est_lu)}
          onClick={() => toutLireMut.mutate()}
        >
          Tout marquer comme lu
        </Button>
      </header>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filtre === 'toutes' ? 'primary' : 'ghost'}
          onClick={() => {
            setFiltre('toutes');
            setPage(1);
          }}
        >
          Toutes
        </Button>
        <Button
          size="sm"
          variant={filtre === 'non_lues' ? 'primary' : 'ghost'}
          onClick={() => {
            setFiltre('non_lues');
            setPage(1);
          }}
        >
          Non lues
          {filtre === 'toutes' && nonLues > 0 && (
            <Badge variant="danger" className="ml-1">
              {nonLues}
            </Badge>
          )}
        </Button>
      </div>

      {query.isLoading && (
        <p className="text-sm text-text-muted" role="status">
          Chargement…
        </p>
      )}
      {query.isError && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {query.error instanceof Error
            ? query.error.message
            : 'Impossible de charger les notifications.'}
        </p>
      )}

      {query.isSuccess && query.data.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="font-semibold text-text">Aucune notification</p>
          <p className="mt-1 text-sm text-text-muted">
            Les invitations et alertes apparaîtront ici.
          </p>
        </div>
      )}

      {query.isSuccess && query.data.items.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {query.data.items.map((n) => (
            <li key={n.id}>
              <Link
                to={n.lien || '/'}
                onClick={() => {
                  if (!n.est_lu) lireMut.mutate(n.id);
                }}
                className={
                  n.est_lu
                    ? 'block px-4 py-3 hover:bg-surface-muted'
                    : 'block bg-ogefrem-blue/5 px-4 py-3 hover:bg-ogefrem-blue/10'
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {LIBELLE_TYPE[n.type] ?? n.type}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {formatDateHeure(n.cree_le)}
                  </p>
                </div>
                <p className="mt-0.5 font-semibold text-text">{n.titre}</p>
                <p className="mt-0.5 text-sm text-text-muted">{n.message}</p>
                {!n.est_lu && (
                  <Badge variant="default" className="mt-2">
                    Non lu
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {query.isSuccess && query.data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </Button>
          <span className="text-xs text-text-muted">
            Page {query.data.pagination.page} / {query.data.pagination.total_pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= query.data.pagination.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
