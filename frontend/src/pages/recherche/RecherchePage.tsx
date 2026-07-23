import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { rechercher } from '@/lib/recherche-api';
import { formatDateHeure, LIBELLES_STATUT } from '@/lib/labels';
import { LIBELLES_STATUT_CR } from '@/lib/cr-workflow';
import { downloadCsv } from '@/lib/csv';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  CalendarDays,
  CheckSquare,
  Download,
  FileText,
  Gavel,
  Search,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

function extraitAvecSurlignage(texte: string | null | undefined, q: string): string {
  if (!texte) return '';
  const plain = texte.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  const lower = plain.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) {
    return plain.length > 160 ? `${plain.slice(0, 160)}…` : plain;
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + needle.length + 80);
  const slice = `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`;
  const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
  return slice.replace(re, '«$1»');
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text }: { text: string }) {
  const parts = text.split(/(«[^»]+»)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('«') && part.endsWith('»') ? (
          <mark
            key={i}
            className="rounded bg-ogefrem-yellow/40 px-0.5 font-semibold text-ogefrem-navy"
          >
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function RecherchePage() {
  const [params, setParams] = useSearchParams();
  const qParam = params.get('q') ?? '';
  const [input, setInput] = useState(qParam);

  const query = useQuery({
    queryKey: ['recherche', 'page', qParam],
    queryFn: () => rechercher(qParam, 30),
    enabled: qParam.trim().length >= 2,
  });

  const total = useMemo(() => {
    const d = query.data;
    if (!d) return 0;
    return (
      d.reunions.length +
      d.comptes_rendus.length +
      d.decisions.length +
      d.actions.length
    );
  }, [query.data]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = input.trim();
    if (term.length < 2) return;
    setParams({ q: term });
  }

  function exportCsv() {
    const d = query.data;
    if (!d) return;
    const rows: string[][] = [['Type', 'Titre', 'Statut', 'Lien / id']];
    for (const r of d.reunions) {
      rows.push(['Réunion', r.titre, r.statut, `/reunions/${r.id}`]);
    }
    for (const cr of d.comptes_rendus) {
      rows.push(['Compte rendu', `v${cr.version}`, cr.statut, `/comptes-rendus/${cr.id}`]);
    }
    for (const dec of d.decisions) {
      rows.push(['Décision', dec.titre, '', `/reunions/${dec.reunion_id}?tab=actions`]);
    }
    for (const a of d.actions) {
      rows.push(['Action', a.titre, a.statut, `/reunions/${a.reunion_id}?tab=actions`]);
    }
    downloadCsv(`recherche-${qParam.slice(0, 30)}.csv`, rows);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Tableau de bord', href: '/' },
          { label: 'Recherche' },
        ]}
      />

      <header className="space-y-3">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-text">
          <Search className="h-6 w-6 text-ogefrem-blue" aria-hidden />
          Recherche
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mot-clé (min. 2 caractères)"
            className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit">Rechercher</Button>
            <Link to="/archives">
              <Button type="button" variant="outline">
                <Archive className="h-4 w-4" aria-hidden />
                Archives
              </Button>
            </Link>
          </div>
        </form>
      </header>

      {qParam.trim().length < 2 && (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-text-muted">
          Saisissez au moins 2 caractères pour lancer une recherche dans les réunions, comptes
          rendus, décisions et actions.
        </p>
      )}

      {qParam.trim().length >= 2 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              {query.isLoading
                ? 'Recherche…'
                : `${total} résultat${total > 1 ? 's' : ''} pour « ${qParam} »`}
            </p>
            {query.isSuccess && total > 0 && (
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" aria-hidden />
                Export CSV
              </Button>
            )}
          </div>

          {query.isError && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {query.error instanceof Error ? query.error.message : 'Erreur de recherche'}
            </p>
          )}

          {query.isSuccess && total === 0 && (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">
              Aucun résultat.
            </p>
          )}

          {query.data && query.data.reunions.length > 0 && (
            <ResultSection title="Réunions" icon={CalendarDays} count={query.data.reunions.length}>
              {query.data.reunions.map((r) => (
                <ResultItem
                  key={r.id}
                  to={`/reunions/${r.id}`}
                  title={r.titre}
                  badge={LIBELLES_STATUT[r.statut]}
                  meta={formatDateHeure(r.date_prevue)}
                  excerpt={extraitAvecSurlignage(
                    `${r.titre}. ${r.description ?? ''} ${r.lieu ?? ''}`,
                    qParam,
                  )}
                />
              ))}
            </ResultSection>
          )}

          {query.data && query.data.comptes_rendus.length > 0 && (
            <ResultSection
              title="Comptes rendus"
              icon={FileText}
              count={query.data.comptes_rendus.length}
            >
              {query.data.comptes_rendus.map((cr) => (
                <ResultItem
                  key={cr.id}
                  to={`/comptes-rendus/${cr.id}`}
                  title={`Compte rendu v${cr.version}`}
                  badge={LIBELLES_STATUT_CR[cr.statut] ?? cr.statut}
                  meta={formatDateHeure(cr.modifie_le)}
                  excerpt={extraitAvecSurlignage(cr.contenu_html, qParam)}
                />
              ))}
            </ResultSection>
          )}

          {query.data && query.data.decisions.length > 0 && (
            <ResultSection
              title="Décisions"
              icon={Gavel}
              count={query.data.decisions.length}
            >
              {query.data.decisions.map((d) => (
                <ResultItem
                  key={d.id}
                  to={
                    d.compte_rendu_id
                      ? `/comptes-rendus/${d.compte_rendu_id}`
                      : `/reunions/${d.reunion_id}?tab=actions`
                  }
                  title={d.titre}
                  badge="Décision"
                  meta={formatDateHeure(d.decide_le)}
                  excerpt={extraitAvecSurlignage(
                    `${d.titre}. ${d.description ?? ''}`,
                    qParam,
                  )}
                />
              ))}
            </ResultSection>
          )}

          {query.data && query.data.actions.length > 0 && (
            <ResultSection title="Actions" icon={CheckSquare} count={query.data.actions.length}>
              {query.data.actions.map((a) => (
                <ResultItem
                  key={a.id}
                  to={
                    a.compte_rendu_id
                      ? `/comptes-rendus/${a.compte_rendu_id}`
                      : `/reunions/${a.reunion_id}?tab=actions`
                  }
                  title={a.titre}
                  badge={a.statut}
                  meta={a.date_echeance ? `Échéance ${a.date_echeance}` : a.priorite}
                  excerpt={extraitAvecSurlignage(
                    `${a.titre}. ${a.description ?? ''}`,
                    qParam,
                  )}
                />
              ))}
            </ResultSection>
          )}
        </>
      )}
    </div>
  );
}

function ResultSection({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
        <Icon className="h-4 w-4 text-ogefrem-blue" aria-hidden />
        {title}
        <Badge variant="neutral">{count}</Badge>
      </h3>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {children}
      </ul>
    </section>
  );
}

function ResultItem({
  to,
  title,
  badge,
  meta,
  excerpt,
}: {
  to: string;
  title: string;
  badge: string;
  meta: string;
  excerpt: string;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={to} className="font-semibold text-ogefrem-blue hover:underline">
          {title}
        </Link>
        <Badge variant="neutral">{badge}</Badge>
        <span className="text-xs text-text-muted">{meta}</span>
      </div>
      {excerpt && (
        <p className="mt-1 text-sm text-text-muted">
          <Highlight text={excerpt} />
        </p>
      )}
    </li>
  );
}
