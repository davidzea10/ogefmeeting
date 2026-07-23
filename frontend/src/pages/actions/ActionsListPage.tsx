import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { listerActions } from '@/lib/actions-decisions-api';
import { formatDateHeure } from '@/lib/labels';
import { listerProfils, listerReunions } from '@/lib/reunions-api';
import type { StatutAction } from '@ogefmeeting/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const FILTRES: { value: '' | StatutAction; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'en_retard', label: 'En retard' },
  { value: 'annulee', label: 'Annulées' },
];

export function ActionsListPage() {
  const [statut, setStatut] = useState<'' | StatutAction>('');
  const [page, setPage] = useState(1);

  const actionsQuery = useQuery({
    queryKey: ['actions', 'liste', { statut, page }],
    queryFn: () =>
      listerActions({
        page,
        limite: 20,
        statut: statut || undefined,
      }),
  });

  const reunionsQuery = useQuery({
    queryKey: ['reunions', 'pour-actions'],
    queryFn: () => listerReunions({ page: 1, limite: 100 }),
  });

  const profilsQuery = useQuery({
    queryKey: ['profils', 'actions'],
    queryFn: () => listerProfils({ limite: 100 }),
  });

  const titres = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reunionsQuery.data?.items ?? []) map.set(r.id, r.titre);
    return map;
  }, [reunionsQuery.data]);

  const noms = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profilsQuery.data?.items ?? []) {
      map.set(p.id, `${p.prenom} ${p.nom}`);
    }
    return map;
  }, [profilsQuery.data]);

  const items = actionsQuery.data?.items ?? [];
  const pagination = actionsQuery.data?.pagination;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Breadcrumbs items={[{ label: 'Actions' }]} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-text">
            <CheckSquare className="h-6 w-6 text-ogefrem-blue" aria-hidden />
            Actions de suivi
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Suivi transversal. Créez des actions depuis un compte rendu.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Filtrer</span>
          <select
            className="h-10 rounded-lg border border-border bg-surface px-3 text-text"
            value={statut}
            onChange={(e) => {
              setStatut(e.target.value as '' | StatutAction);
              setPage(1);
            }}
          >
            {FILTRES.map((f) => (
              <option key={f.value || 'all'} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {actionsQuery.isLoading && (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          Chargement…
        </p>
      )}

      {actionsQuery.isError && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger" role="alert">
          {actionsQuery.error instanceof Error
            ? actionsQuery.error.message
            : 'Impossible de charger les actions.'}
        </p>
      )}

      {actionsQuery.isSuccess && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="font-medium text-text">Aucune action</p>
          <p className="mt-1 text-sm text-text-muted">
            Ouvrez un compte rendu et ajoutez une action de suivi.
          </p>
          <Link to="/comptes-rendus" className="mt-4 inline-block">
            <Button size="sm">Voir les comptes rendus</Button>
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-text">{a.titre}</p>
                  <p className="text-xs text-text-muted">
                    {titres.get(a.reunion_id) ?? 'Réunion'}
                    {' · '}
                    {a.responsable_id
                      ? noms.get(a.responsable_id) ?? 'Responsable'
                      : 'Non assigné'}
                    {a.date_echeance ? ` · échéance ${a.date_echeance}` : ''}
                    {' · '}
                    {formatDateHeure(a.cree_le)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant="neutral">{a.statut}</Badge>
                  <Badge variant="default">{a.priorite}</Badge>
                  {a.compte_rendu_id ? (
                    <Link to={`/comptes-rendus/${a.compte_rendu_id}`}>
                      <Button size="sm" variant="outline">
                        CR
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/reunions/${a.reunion_id}?tab=actions`}>
                      <Button size="sm" variant="ghost">
                        Réunion
                      </Button>
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                Page {pagination.page} / {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
