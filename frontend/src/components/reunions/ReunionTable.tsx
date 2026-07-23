import { ReunionStatusBadge } from '@/components/reunions/ReunionStatusBadge';
import { Button } from '@/components/ui/Button';
import { formatDateHeure, LIBELLES_TYPE } from '@/lib/labels';
import type { Reunion } from '@ogefmeeting/shared';
import { Archive, Eye, Pencil, Play, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  reunions: Reunion[];
  onDemarrer: (id: string) => void;
  onArchiver: (id: string) => void;
  actionLoadingId: string | null;
};

function Actions({
  reunion,
  loading,
  onDemarrer,
  onArchiver,
}: {
  reunion: Reunion;
  loading: boolean;
  onDemarrer: (id: string) => void;
  onArchiver: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Link to={`/reunions/${reunion.id}`} title="Voir">
        <Button variant="ghost" size="icon" aria-label={`Voir ${reunion.titre}`}>
          <Eye className="h-4 w-4" aria-hidden />
        </Button>
      </Link>
      <Link to={`/reunions/${reunion.id}/modifier`} title="Modifier">
        <Button variant="ghost" size="icon" aria-label={`Modifier ${reunion.titre}`}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      </Link>
      {reunion.statut === 'planifiee' && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Démarrer ${reunion.titre}`}
          loading={loading}
          onClick={() => onDemarrer(reunion.id)}
        >
          {!loading && <Play className="h-4 w-4" aria-hidden />}
        </Button>
      )}
      {reunion.statut === 'en_cours' && (
        <Link to={`/reunions/${reunion.id}/live`} title="Mode live">
          <Button variant="ghost" size="icon" aria-label={`Mode live — ${reunion.titre}`}>
            <Radio className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      )}
      {reunion.statut !== 'archivee' && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Archiver ${reunion.titre}`}
          loading={loading}
          onClick={() => onArchiver(reunion.id)}
        >
          {!loading && <Archive className="h-4 w-4" aria-hidden />}
        </Button>
      )}
    </div>
  );
}

export function ReunionTable({
  reunions,
  onDemarrer,
  onArchiver,
  actionLoadingId,
}: Props) {
  return (
    <>
      {/* Cartes mobile */}
      <ul className="space-y-3 md:hidden">
        {reunions.map((reunion) => {
          const loading = actionLoadingId === reunion.id;
          return (
            <li
              key={reunion.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/reunions/${reunion.id}`}
                    className="block text-[15px] font-semibold leading-snug text-ogefrem-blue"
                  >
                    {reunion.titre}
                  </Link>
                  <p className="mt-1 text-xs text-text-muted">
                    {formatDateHeure(reunion.date_prevue)}
                    {reunion.lieu ? ` · ${reunion.lieu}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {LIBELLES_TYPE[reunion.type_reunion]}
                  </p>
                </div>
                <ReunionStatusBadge statut={reunion.statut} />
              </div>
              <div className="mt-3 border-t border-border pt-2">
                <Actions
                  reunion={reunion}
                  loading={loading}
                  onDemarrer={onDemarrer}
                  onArchiver={onArchiver}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Tableau desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Titre
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Type
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Statut
              </th>
              <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
                Lieu
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {reunions.map((reunion) => {
              const loading = actionLoadingId === reunion.id;
              return (
                <tr
                  key={reunion.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/reunions/${reunion.id}`}
                      className="font-semibold text-ogefrem-blue hover:underline"
                    >
                      {reunion.titre}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                    {formatDateHeure(reunion.date_prevue)}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {LIBELLES_TYPE[reunion.type_reunion]}
                  </td>
                  <td className="px-4 py-3">
                    <ReunionStatusBadge statut={reunion.statut} />
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-4 py-3 text-text-muted lg:table-cell">
                    {reunion.lieu ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Actions
                      reunion={reunion}
                      loading={loading}
                      onDemarrer={onDemarrer}
                      onArchiver={onArchiver}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
