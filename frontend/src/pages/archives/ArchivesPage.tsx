import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { listerComptesRendus } from '@/lib/comptes-rendus-api';
import { LIBELLES_STATUT_CR } from '@/lib/cr-workflow';
import { downloadCsv } from '@/lib/csv';
import {
  debutJourneeISO,
  finJourneeISO,
  formatDateHeure,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
} from '@/lib/labels';
import { listerDirections, listerProfils, listerReunions } from '@/lib/reunions-api';
import type { TypeReunion } from '@ogefmeeting/shared';
import { useQuery } from '@tanstack/react-query';
import { Archive, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type Onglet = 'reunions' | 'comptes-rendus';

export function ArchivesPage() {
  const [onglet, setOnglet] = useState<Onglet>('reunions');
  const [directionId, setDirectionId] = useState('');
  const [typeReunion, setTypeReunion] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [page, setPage] = useState(1);

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirections,
  });

  const profilsQuery = useQuery({
    queryKey: ['profils', 'archives'],
    queryFn: () => listerProfils({ limite: 100 }),
  });

  const reunionsQuery = useQuery({
    queryKey: [
      'archives',
      'reunions',
      { directionId, typeReunion, participantId, dateDebut, dateFin, page },
    ],
    queryFn: () =>
      listerReunions({
        page,
        limite: 15,
        statut: 'archivee',
        direction_id: directionId || undefined,
        type_reunion: (typeReunion || undefined) as TypeReunion | undefined,
        participant_id: participantId || undefined,
        date_apres: dateDebut ? debutJourneeISO(dateDebut) : undefined,
        date_avant: dateFin ? finJourneeISO(dateFin) : undefined,
        tri: 'date_prevue',
        ordre: 'desc',
      }),
    enabled: onglet === 'reunions',
  });

  const crQuery = useQuery({
    queryKey: ['archives', 'cr', { page }],
    queryFn: () =>
      listerComptesRendus({
        page,
        limite: 15,
        statut: 'archive',
      }),
    enabled: onglet === 'comptes-rendus',
  });

  const titresReunion = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reunionsQuery.data?.items ?? []) map.set(r.id, r.titre);
    return map;
  }, [reunionsQuery.data]);

  // Pour les CR archivés, charger les titres de réunions associées (best effort)
  const reunionsPourCrQuery = useQuery({
    queryKey: ['reunions', 'pour-archives-cr'],
    queryFn: () => listerReunions({ page: 1, limite: 100, statut: 'archivee' }),
    enabled: onglet === 'comptes-rendus',
  });

  const titresCr = useMemo(() => {
    const map = new Map(titresReunion);
    for (const r of reunionsPourCrQuery.data?.items ?? []) map.set(r.id, r.titre);
    return map;
  }, [titresReunion, reunionsPourCrQuery.data]);

  function resetFiltres() {
    setDirectionId('');
    setTypeReunion('');
    setParticipantId('');
    setDateDebut('');
    setDateFin('');
    setPage(1);
  }

  function exportCsv() {
    if (onglet === 'reunions') {
      const rows: string[][] = [
        ['Titre', 'Type', 'Date', 'Lieu', 'Statut', 'Id'],
      ];
      for (const r of reunionsQuery.data?.items ?? []) {
        rows.push([
          r.titre,
          LIBELLES_TYPE[r.type_reunion] ?? r.type_reunion,
          r.date_prevue,
          r.lieu ?? '',
          r.statut,
          r.id,
        ]);
      }
      downloadCsv('archives-reunions.csv', rows);
      return;
    }
    const rows: string[][] = [['Version', 'Statut', 'Réunion', 'Modifié le', 'Id']];
    for (const cr of crQuery.data?.items ?? []) {
      rows.push([
        String(cr.version),
        cr.statut,
        titresCr.get(cr.reunion_id) ?? cr.reunion_id,
        cr.modifie_le,
        cr.id,
      ]);
    }
    downloadCsv('archives-comptes-rendus.csv', rows);
  }

  const pagination =
    onglet === 'reunions' ? reunionsQuery.data?.pagination : crQuery.data?.pagination;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Tableau de bord', href: '/' },
          { label: 'Archives' },
        ]}
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-text">
            <Archive className="h-6 w-6 text-ogefrem-blue" aria-hidden />
            Archives
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Réunions et comptes rendus archivés — filtres avancés et export CSV.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={
            onglet === 'reunions'
              ? !reunionsQuery.data?.items.length
              : !crQuery.data?.items.length
          }
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </header>

      <div className="flex gap-2 border-b border-border pb-px">
        <TabBtn
          active={onglet === 'reunions'}
          onClick={() => {
            setOnglet('reunions');
            setPage(1);
          }}
          label="Réunions archivées"
        />
        <TabBtn
          active={onglet === 'comptes-rendus'}
          onClick={() => {
            setOnglet('comptes-rendus');
            setPage(1);
          }}
          label="CR archivés"
        />
      </div>

      {onglet === 'reunions' && (
        <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-text-muted">
            Direction
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
              value={directionId}
              onChange={(e) => {
                setDirectionId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Toutes</option>
              {(directionsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ? `${d.code} — ${d.nom}` : d.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-muted">
            Type
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
              value={typeReunion}
              onChange={(e) => {
                setTypeReunion(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tous</option>
              {(Object.keys(LIBELLES_TYPE) as TypeReunion[]).map((k) => (
                <option key={k} value={k}>
                  {LIBELLES_TYPE[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-muted">
            Participant
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
              value={participantId}
              onChange={(e) => {
                setParticipantId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tous</option>
              {(profilsQuery.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prenom} {p.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-muted">
            Date début
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
              value={dateDebut}
              onChange={(e) => {
                setDateDebut(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="text-xs text-text-muted">
            Date fin
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
              value={dateFin}
              onChange={(e) => {
                setDateFin(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="flex items-end">
            <Button size="sm" variant="ghost" onClick={resetFiltres}>
              Réinitialiser
            </Button>
          </div>
        </div>
      )}

      {onglet === 'reunions' && (
        <>
          {reunionsQuery.isLoading && (
            <p className="text-sm text-text-muted">Chargement…</p>
          )}
          {reunionsQuery.isSuccess && reunionsQuery.data.items.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
              Aucune réunion archivée pour ces filtres.
            </p>
          )}
          {reunionsQuery.isSuccess && reunionsQuery.data.items.length > 0 && (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {reunionsQuery.data.items.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/reunions/${r.id}`}
                      className="font-semibold text-ogefrem-blue hover:underline"
                    >
                      {r.titre}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {formatDateHeure(r.date_prevue)}
                      {' · '}
                      {LIBELLES_TYPE[r.type_reunion]}
                      {r.lieu ? ` · ${r.lieu}` : ''}
                    </p>
                  </div>
                  <Badge variant="neutral">{LIBELLES_STATUT[r.statut]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {onglet === 'comptes-rendus' && (
        <>
          {crQuery.isLoading && <p className="text-sm text-text-muted">Chargement…</p>}
          {crQuery.isSuccess && crQuery.data.items.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
              Aucun compte rendu archivé.
            </p>
          )}
          {crQuery.isSuccess && crQuery.data.items.length > 0 && (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {crQuery.data.items.map((cr) => (
                <li
                  key={cr.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/comptes-rendus/${cr.id}`}
                      className="font-semibold text-ogefrem-blue hover:underline"
                    >
                      {titresCr.get(cr.reunion_id) ?? `CR v${cr.version}`}
                    </Link>
                    <p className="text-xs text-text-muted">
                      Version {cr.version} · Modifié le {formatDateHeure(cr.modifie_le)}
                    </p>
                  </div>
                  <Badge variant="neutral">
                    {LIBELLES_STATUT_CR[cr.statut] ?? cr.statut}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

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
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-t-lg border border-b-0 border-border bg-surface px-3 py-2 text-sm font-semibold text-ogefrem-blue'
          : 'px-3 py-2 text-sm font-semibold text-text-muted hover:text-text'
      }
    >
      {label}
    </button>
  );
}
