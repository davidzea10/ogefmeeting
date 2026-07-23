import { Button } from '@/components/ui/Button';
import {
  compterNotificationsNonLues,
  listerNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
} from '@/lib/notifications-api';
import { formatDateHeure } from '@/lib/labels';
import { useAuthStore } from '@/stores/auth.store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

export function NotificationBell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const countQuery = useQuery({
    queryKey: ['notifications', 'non-lues'],
    queryFn: compterNotificationsNonLues,
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ['notifications', 'liste'],
    queryFn: () => listerNotifications({ page: 1, limite: 15 }),
    enabled: Boolean(accessToken) && open,
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
    },
  });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!accessToken) return null;

  const nonLues = countQuery.data?.non_lues ?? 0;

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          nonLues > 0
            ? `Notifications, ${nonLues} non lues`
            : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {nonLues > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Centre de notifications"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {nonLues > 0 && (
              <Button
                size="sm"
                variant="ghost"
                loading={toutLireMut.isPending}
                onClick={() => toutLireMut.mutate()}
              >
                Tout marquer lu
              </Button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {listQuery.isLoading && (
              <li className="px-3 py-6 text-center text-sm text-text-muted">
                Chargement…
              </li>
            )}
            {listQuery.isSuccess && listQuery.data.items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-text-muted">
                Aucune notification.
              </li>
            )}
            {listQuery.data?.items.map((n) => (
              <li key={n.id} className="border-b border-border last:border-0">
                <Link
                  to={n.lien || '/'}
                  onClick={() => {
                    if (!n.est_lu) lireMut.mutate(n.id);
                    setOpen(false);
                  }}
                  className={
                    n.est_lu
                      ? 'block px-3 py-2.5 hover:bg-surface-muted'
                      : 'block bg-ogefrem-blue/5 px-3 py-2.5 hover:bg-ogefrem-blue/10'
                  }
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {LIBELLE_TYPE[n.type] ?? n.type}
                  </p>
                  <p className="text-sm font-medium text-text">{n.titre}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {formatDateHeure(n.cree_le)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
