import { Button } from '@/components/ui/Button';
import {
  NotificationItemActions,
  notificationAvecActionsCr,
} from '@/components/notifications/NotificationItemActions';
import {
  compterNotificationsNonLues,
  listerNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
} from '@/lib/notifications-api';
import { formatDateHeure } from '@/lib/labels';
import { useAuthStore } from '@/stores/auth.store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LIBELLE_TYPE: Record<string, string> = {
  invitation_reunion: 'Invitation',
  invitation_repondue: 'Réponse invitation',
  reunion_demarree: 'Réunion en cours',
  reunion_cloturee: 'Réunion clôturée',
  reunion_heure_depassee: 'Réunion en retard',
  reunion_heure_depassee_modifiee: 'Réunion replanifiée',
  reunion_a_valider: 'À valider',
  reunion_approuvee: 'Réunion approuvée',
  reunion_refusee: 'Réunion refusée',
  rappel_reunion_quotidien: 'Rappel réunion',
  rappel_reunion_2h: 'Dans 2 heures',
  rappel_reunion_1h: 'Dans 1 heure',
  cr_a_valider: 'CR à valider',
  cr_soumis: 'CR soumis',
  cr_en_revision: 'CR en révision',
  cr_publie: 'CR publié',
  cr_disponible: 'Compte rendu',
  cr_valide: 'CR validé',
  cr_archive: 'CR archivé',
  action_en_retard: 'Action en retard',
};

export function NotificationBell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  function ouvrirPageComplete() {
    setOpen(false);
    navigate('/notifications');
  }

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
          className="fixed inset-x-3 top-[calc(var(--header-height)+0.5rem+env(safe-area-inset-top))] z-50 mx-auto w-auto max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mx-0 sm:mt-2 sm:w-[min(22rem,calc(100vw-1.5rem))]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-text">Notifications</p>
            <div className="flex shrink-0 items-center gap-1">
              {nonLues > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={toutLireMut.isPending}
                  onClick={() => toutLireMut.mutate()}
                >
                  Tout lu
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                aria-label="Ouvrir toutes les notifications"
                title="Voir toutes"
                onClick={ouvrirPageComplete}
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <ul className="max-h-[min(22rem,55vh)] overflow-y-auto">
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
                {notificationAvecActionsCr(n) ? (
                  <div className={n.est_lu ? '' : 'bg-ogefrem-blue/5'}>
                    <NotificationItemActions
                      notification={n}
                      libelleType={LIBELLE_TYPE[n.type] ?? n.type}
                      dateLabel={formatDateHeure(n.cree_le)}
                      compact
                      onNavigate={() => setOpen(false)}
                      onMarkRead={(id) => lireMut.mutate(id)}
                    />
                  </div>
                ) : (
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
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-border bg-surface-muted/60 px-3 py-2">
            <button
              type="button"
              onClick={ouvrirPageComplete}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-ogefrem-blue hover:bg-ogefrem-blue/10"
            >
              Voir toutes les notifications
              <ExternalLink className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
