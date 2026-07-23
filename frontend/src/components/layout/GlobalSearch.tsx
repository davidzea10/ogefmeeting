import { cn } from '@/lib/cn';
import { rechercher } from '@/lib/recherche-api';
import { useQuery } from '@tanstack/react-query';
import { Archive, FileText, Gavel, CheckSquare, CalendarDays, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type Props = {
  className?: string;
  /** Afficher le champ même sur mobile */
  alwaysVisible?: boolean;
};

export function GlobalSearch({ className, alwaysVisible = false }: Props) {
  const navigate = useNavigate();
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const suggestionsQuery = useQuery({
    queryKey: ['recherche', 'suggestions', debounced],
    queryFn: () => rechercher(debounced, 5),
    enabled: debounced.length >= 2 && open,
  });

  const data = suggestionsQuery.data;
  const total =
    (data?.reunions.length ?? 0) +
    (data?.comptes_rendus.length ?? 0) +
    (data?.decisions.length ?? 0) +
    (data?.actions.length ?? 0);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    setOpen(false);
    navigate(`/recherche?q=${encodeURIComponent(term)}`);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        alwaysVisible ? 'block' : 'hidden md:block',
        'relative w-full max-w-md',
        className,
      )}
    >
      <form onSubmit={submit} role="search">
        <label className="sr-only" htmlFor={inputId}>
          Recherche globale
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            id={inputId}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher réunion, CR, décision…"
            autoComplete="off"
            className={cn(
              'h-11 w-full rounded-lg border border-border bg-surface-muted pl-10 pr-3 text-sm',
              'placeholder:text-text-muted focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25',
            )}
            aria-autocomplete="list"
            aria-expanded={open && debounced.length >= 2}
            aria-controls={`${inputId}-listbox`}
          />
        </div>
      </form>

      {open && debounced.length >= 2 && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg"
        >
          {suggestionsQuery.isLoading && (
            <p className="px-3 py-3 text-sm text-text-muted">Recherche…</p>
          )}
          {suggestionsQuery.isError && (
            <p className="px-3 py-3 text-sm text-danger">Erreur de recherche.</p>
          )}
          {suggestionsQuery.isSuccess && total === 0 && (
            <p className="px-3 py-3 text-sm text-text-muted">Aucun résultat pour « {debounced} ».</p>
          )}

          {data && data.reunions.length > 0 && (
            <SuggestionGroup title="Réunions" icon={CalendarDays}>
              {data.reunions.map((r) => (
                <SuggestionLink
                  key={r.id}
                  to={`/reunions/${r.id}`}
                  label={r.titre}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </SuggestionGroup>
          )}
          {data && data.comptes_rendus.length > 0 && (
            <SuggestionGroup title="Comptes rendus" icon={FileText}>
              {data.comptes_rendus.map((cr) => (
                <SuggestionLink
                  key={cr.id}
                  to={`/comptes-rendus/${cr.id}`}
                  label={`CR v${cr.version} · ${cr.statut}`}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </SuggestionGroup>
          )}
          {data && data.decisions.length > 0 && (
            <SuggestionGroup title="Décisions" icon={Gavel}>
              {data.decisions.map((d) => (
                <SuggestionLink
                  key={d.id}
                  to={
                    d.compte_rendu_id
                      ? `/comptes-rendus/${d.compte_rendu_id}`
                      : `/reunions/${d.reunion_id}?tab=actions`
                  }
                  label={d.titre}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </SuggestionGroup>
          )}
          {data && data.actions.length > 0 && (
            <SuggestionGroup title="Actions" icon={CheckSquare}>
              {data.actions.map((a) => (
                <SuggestionLink
                  key={a.id}
                  to={
                    a.compte_rendu_id
                      ? `/comptes-rendus/${a.compte_rendu_id}`
                      : `/reunions/${a.reunion_id}?tab=actions`
                  }
                  label={a.titre}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </SuggestionGroup>
          )}

          <div className="border-t border-border p-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ogefrem-blue hover:bg-ogefrem-blue/5"
              onClick={() => submit()}
            >
              <Search className="h-4 w-4" aria-hidden />
              Voir tous les résultats pour « {debounced} »
            </button>
            <Link
              to="/archives"
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-muted hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              <Archive className="h-4 w-4" aria-hidden />
              Ouvrir les archives
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border py-1">
      <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </p>
      {children}
    </div>
  );
}

function SuggestionLink({
  to,
  label,
  onNavigate,
}: {
  to: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      role="option"
      className="block truncate px-3 py-2 text-sm text-text hover:bg-ogefrem-blue/5"
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}
