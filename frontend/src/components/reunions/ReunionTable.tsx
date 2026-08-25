import { ReunionStatusBadge } from '@/components/reunions/ReunionStatusBadge';
import { Button } from '@/components/ui/Button';
import { formatDateHeure, LIBELLES_TYPE } from '@/lib/labels';
import { peutGererReunionRole, peutModifierReunionRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
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
  peutModifier,
  peutGerer,
}: {
  reunion: Reunion;
  loading: boolean;
  onDemarrer: (id: string) => void;
  onArchiver: (id: string) => void;
  peutModifier: boolean;
  peutGerer: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Link to={`/reunions/${reunion.id}`} title="Voir">
        <Button variant="ghost" size="icon" aria-label={`Voir ${reunion.titre}`}>
          <Eye className="h-4 w-4" aria-hidden />
        </Button>
      </Link>
      {peutModifier && (
        <Link to={`/reunions/${reunion.id}/modifier`} title="Modifier">
          <Button variant="ghost" size="icon" aria-label={`Modifier ${reunion.titre}`}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      )}
      {peutGerer && reunion.statut === 'planifiee' && (
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
      {peutGerer && reunion.statut !== 'archivee' && (
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
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? s.profil?.id);

  return (
    <>
      {/* Cartes mobile */}
      <ul className="space-y-3 md:hidden">
        {reunions.map((reunion) => {
          const loading = actionLoadingId === reunion.id;
          const peutModifier = peutModifierReunionRole(
            role,
            profil?.fonction,
            userId,
            reunion,
          );
          const peutGerer = peutGererReunionRole(
            role,
            profil?.fonction,
            userId,
            reunion,
          );
          return (
            <li
              key={reunion.id}
              className="rounded-2xl border border-border/80 bg-surface p-4 shadow-sm ring-1 ring-black/[0.02]"
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
              <div className="mt-3 border-t border-border/70 pt-2">
                <Actions
                  reunion={reunion}
                  loading={loading}
                  onDemarrer={onDemarrer}
                  onArchiver={onArchiver}
                  peutModifier={peutModifier}
                  peutGerer={peutGerer}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Tableau desktop moderne */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm ring-1 ring-black/[0.02] md:block">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-gradient-to-r from-ogefrem-navy/[0.04] to-ogefrem-blue/[0.06]">
              <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Titre
              </th>
              <th scope="col" className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Date
              </th>
              <th scope="col" className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Type
              </th>
              <th scope="col" className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Statut
              </th>
              <th scope="col" className="hidden px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-text-muted lg:table-cell">
                Lieu
              </th>
              <th scope="col" className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {reunions.map((reunion) => {
              const loading = actionLoadingId === reunion.id;
              const peutModifier = peutModifierReunionRole(
                role,
                profil?.fonction,
                userId,
                reunion,
              );
              const peutGerer = peutGererReunionRole(
                role,
                profil?.fonction,
                userId,
                reunion,
              );
              return (
                <tr
                  key={reunion.id}
                  className="transition-colors hover:bg-ogefrem-blue/[0.03]"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/reunions/${reunion.id}`}
                      className="font-semibold text-ogefrem-blue hover:underline"
                    >
                      {reunion.titre}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-text-muted">
                    {formatDateHeure(reunion.date_prevue)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                      {LIBELLES_TYPE[reunion.type_reunion]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <ReunionStatusBadge statut={reunion.statut} />
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-4 py-3.5 text-text-muted lg:table-cell">
                    {reunion.lieu ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Actions
                      reunion={reunion}
                      loading={loading}
                      onDemarrer={onDemarrer}
                      onArchiver={onArchiver}
                      peutModifier={peutModifier}
                      peutGerer={peutGerer}
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
