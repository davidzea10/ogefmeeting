import { Button } from '@/components/ui/Button';
import type { Profil } from '@ogefmeeting/shared';
import { Search, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  profils: Profil[];
  /** Profils déjà participants (ne pas proposer). */
  dejaInvitesIds: Set<string>;
  loading?: boolean;
  onSubmit: (profilIds: string[]) => void;
};

function libelleProfil(p: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
}): string {
  const nomComplet = `${p.prenom ?? ''} ${p.nom ?? ''}`.trim();
  if (nomComplet) return nomComplet;
  if (p.email?.trim()) return p.email.trim();
  return 'Participant';
}

export function AjouterInvitesModal({
  open,
  onClose,
  profils,
  dejaInvitesIds,
  loading,
  onSubmit,
}: Props) {
  const [q, setQ] = useState('');
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setSelection([]);
    }
  }, [open]);

  const disponibles = useMemo(
    () => profils.filter((p) => !dejaInvitesIds.has(p.id)),
    [profils, dejaInvitesIds],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return disponibles;
    return disponibles.filter((p) => {
      const label = libelleProfil(p).toLowerCase();
      return (
        label.includes(needle) ||
        (p.prenom ?? '').toLowerCase().includes(needle) ||
        (p.nom ?? '').toLowerCase().includes(needle) ||
        (p.email ?? '').toLowerCase().includes(needle)
      );
    });
  }, [disponibles, q]);

  const selectionSet = useMemo(() => new Set(selection), [selection]);

  function toggle(id: string) {
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleClose() {
    if (loading) return;
    setQ('');
    setSelection([]);
    onClose();
  }

  function handleSubmit() {
    if (selection.length === 0) return;
    onSubmit(selection);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajouter-invites-titre"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-lg"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="ajouter-invites-titre" className="text-lg font-bold text-text">
              Ajouter des invités
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Les personnes sélectionnées recevront une invitation (app + e-mail).
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-text-muted hover:bg-surface-muted hover:text-text"
            onClick={handleClose}
            disabled={loading}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher dans l’annuaire…"
              className="h-11 w-full rounded-lg border border-border bg-surface pl-10 text-sm text-text focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25"
              aria-label="Rechercher un invité"
              autoFocus
            />
          </div>
          {selection.length > 0 && (
            <p className="text-xs font-medium text-ogefrem-blue">
              {selection.length} personne{selection.length > 1 ? 's' : ''} sélectionnée
              {selection.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <ul
          className="min-h-0 flex-1 overflow-y-auto border-y border-border divide-y divide-border"
          aria-label="Annuaire"
        >
          {filtered.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-text-muted">
              {disponibles.length === 0
                ? 'Tous les profils de l’annuaire sont déjà invités.'
                : 'Aucun résultat pour cette recherche.'}
            </li>
          ) : (
            filtered.map((p) => {
              const selected = selectionSet.has(p.id);
              const label = libelleProfil(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                      selected
                        ? 'bg-ogefrem-blue/8'
                        : 'hover:bg-surface-muted/60'
                    }`}
                    onClick={() => toggle(p.id)}
                    aria-pressed={selected}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        selected
                          ? 'border-ogefrem-blue bg-ogefrem-blue text-white'
                          : 'border-border bg-surface'
                      }`}
                      aria-hidden
                    >
                      {selected ? '✓' : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">
                        {label}
                      </span>
                      {p.email ? (
                        <span className="block truncate text-xs text-text-muted">
                          {p.email}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            loading={loading}
            disabled={selection.length === 0}
            onClick={handleSubmit}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            {selection.length > 1
              ? `Envoyer ${selection.length} invitations`
              : 'Envoyer l’invitation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
