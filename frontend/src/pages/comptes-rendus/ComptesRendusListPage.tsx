import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { listerComptesRendus, telechargerPdfCompteRendu } from '@/lib/comptes-rendus-api';
import { LIBELLES_STATUT_CR } from '@/lib/cr-workflow';
import { formatDateHeure } from '@/lib/labels';
import { listerReunions } from '@/lib/reunions-api';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const FILTRES_STATUT = [
  { value: '', label: 'Tous les statuts' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'soumis', label: 'Soumis' },
  { value: 'en_revision', label: 'En révision' },
  { value: 'valide', label: 'Validé' },
  { value: 'archive', label: 'Archivé' },
] as const;

function badgeVariantPourStatut(statut: string): 'neutral' | 'warning' | 'success' | 'default' {
  if (statut === 'valide') return 'success';
  if (statut === 'soumis') return 'warning';
  if (statut === 'en_revision') return 'default';
  return 'neutral';
}

export function ComptesRendusListPage() {
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);

  const crQuery = useQuery({
    queryKey: ['comptes-rendus', 'liste', { statut, page }],
    queryFn: () =>
      listerComptesRendus({
        page,
        limite: 20,
        statut: statut || undefined,
      }),
  });

  const reunionsQuery = useQuery({
    queryKey: ['reunions', 'pour-cr'],
    queryFn: () => listerReunions({ page: 1, limite: 100 }),
  });

  const titresReunion = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reunionsQuery.data?.items ?? []) {
      map.set(r.id, r.titre);
    }
    return map;
  }, [reunionsQuery.data]);

  const items = crQuery.data?.items ?? [];
  const pagination = crQuery.data?.pagination;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Breadcrumbs items={[{ label: 'Comptes rendus' }]} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Comptes rendus</h2>
          <p className="mt-1 text-sm text-text-muted">
            Ouvrez un brouillon pour le rédiger, ou créez-en un en clôturant une réunion.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Filtrer</span>
          <select
            className="h-10 rounded-lg border border-border bg-surface px-3 text-text"
            value={statut}
            onChange={(e) => {
              setStatut(e.target.value);
              setPage(1);
            }}
          >
            {FILTRES_STATUT.map((f) => (
              <option key={f.value || 'all'} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {crQuery.isLoading && (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          Chargement…
        </p>
      )}

      {crQuery.isError && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger" role="alert">
          {crQuery.error instanceof Error
            ? crQuery.error.message
            : 'Impossible de charger les comptes rendus.'}
        </p>
      )}

      {crQuery.isSuccess && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-text-muted" aria-hidden />
          <p className="mt-3 font-medium text-text">Aucun compte rendu</p>
          <p className="mt-1 text-sm text-text-muted">
            Clôturez une réunion (mode live) pour générer un brouillon automatiquement.
          </p>
          <Link to="/reunions" className="mt-4 inline-block">
            <Button size="sm">Voir les réunions</Button>
          </Link>
        </div>
      )}

      {crQuery.isSuccess && items.length > 0 && (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((cr) => {
              const titre =
                titresReunion.get(cr.reunion_id) ?? `Réunion ${cr.reunion_id.slice(0, 8)}…`;
              return (
                <li
                  key={cr.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <Link
                      to={`/comptes-rendus/${cr.id}`}
                      className="block truncate font-semibold text-ogefrem-blue hover:underline"
                    >
                      {titre}
                    </Link>
                    <p className="text-xs text-text-muted">
                      Version {cr.version} · Modifié le {formatDateHeure(cr.modifie_le)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={badgeVariantPourStatut(cr.statut)}>
                      {LIBELLES_STATUT_CR[cr.statut as keyof typeof LIBELLES_STATUT_CR] ??
                        cr.statut}
                    </Badge>
                    <Link to={`/comptes-rendus/${cr.id}`}>
                      <Button size="sm">Ouvrir</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const { blob, filename } = await telechargerPdfCompteRendu(cr.id);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      PDF
                    </Button>
                    <Link to={`/reunions/${cr.reunion_id}?tab=compte-rendu`}>
                      <Button size="sm" variant="ghost">
                        Réunion
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                Page {pagination.page} / {pagination.total_pages} · {pagination.total} au total
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
