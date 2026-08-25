import { Button } from '@/components/ui/Button';
import type { ReunionFormValues } from '@/schemas/reunion-form.schema';
import type { Profil } from '@ogefmeeting/shared';
import { Search, UserMinus, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';

type Props = {
  profils: Profil[];
  watch: UseFormWatch<ReunionFormValues>;
  setValue: UseFormSetValue<ReunionFormValues>;
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

export function StepParticipants({ profils, watch, setValue }: Props) {
  const [q, setQ] = useState('');
  const selected = watch('participants');
  const multiDirection = watch('multi_direction');
  const directionId = watch('direction_id');
  const directionIds = watch('direction_ids');
  const inclureAutresDirections = watch('participants_autres_directions');

  const selectedIds = useMemo(
    () => new Set(selected.map((p) => p.profil_id)),
    [selected],
  );

  const directionScopeIds = useMemo(
    () => (multiDirection ? directionIds : (directionId ? [directionId] : [])),
    [multiDirection, directionIds, directionId],
  );

  const annuaireFiltrable = useMemo(() => {
    if (directionScopeIds.length === 0) return profils;
    if (inclureAutresDirections) return profils;
    return profils.filter(
      (p) => p.direction_id && directionScopeIds.includes(p.direction_id),
    );
  }, [profils, directionScopeIds, inclureAutresDirections]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return annuaireFiltrable;
    return annuaireFiltrable.filter((p) => {
      const label = libelleProfil(p).toLowerCase();
      return (
        label.includes(needle) ||
        (p.prenom ?? '').toLowerCase().includes(needle) ||
        (p.nom ?? '').toLowerCase().includes(needle) ||
        (p.email ?? '').toLowerCase().includes(needle)
      );
    });
  }, [annuaireFiltrable, q]);

  function addProfil(p: Profil) {
    if (selectedIds.has(p.id)) return;
    setValue(
      'participants',
      [
        ...selected,
        {
          profil_id: p.id,
          prenom: p.prenom ?? '',
          nom: p.nom ?? '',
          email: p.email ?? '',
        },
      ],
      { shouldDirty: true },
    );
  }

  function removeProfil(id: string) {
    setValue(
      'participants',
      selected.filter((p) => p.profil_id !== id),
      { shouldDirty: true },
    );
  }

  function addAllVisible() {
    const toAdd = filtered.filter((p) => !selectedIds.has(p.id));
    if (toAdd.length === 0) return;
    setValue(
      'participants',
      [
        ...selected,
        ...toAdd.map((p) => ({
          profil_id: p.id,
          prenom: p.prenom ?? '',
          nom: p.nom ?? '',
          email: p.email ?? '',
        })),
      ],
      { shouldDirty: true },
    );
  }

  function clearAllSelected() {
    setValue('participants', [], { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
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
          aria-label="Rechercher un participant"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addAllVisible}>
            Sélectionner tout (résultats)
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAllSelected}>
            Vider la sélection
          </Button>
        </div>
        {directionScopeIds.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ogefrem-blue"
              checked={inclureAutresDirections}
              onChange={(e) =>
                setValue('participants_autres_directions', e.target.checked, {
                  shouldDirty: true,
                })
              }
            />
            Participants autres directions
          </label>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="max-h-72 overflow-y-auto rounded-xl border border-border bg-surface"
          aria-label="Annuaire"
        >
          <ul className="divide-y divide-border">
            {filtered.map((p) => {
              const already = selectedIds.has(p.id);
              const label = libelleProfil(p);
              const aNomComplet = Boolean(`${p.prenom ?? ''} ${p.nom ?? ''}`.trim());
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">
                      {label}
                    </p>
                    {aNomComplet && p.email ? (
                      <p className="truncate text-xs text-text-muted">{p.email}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={already ? 'ghost' : 'secondary'}
                    disabled={already}
                    onClick={() => addProfil(p)}
                    aria-label={`Ajouter ${label}`}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden />
                    {already ? 'Ajouté' : 'Ajouter'}
                  </Button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-text-muted">
                Aucun profil trouvé.
              </li>
            )}
          </ul>
        </section>

        <section
          className="rounded-xl border border-border bg-surface-muted/40 p-3"
          aria-label="Participants sélectionnés"
        >
          <h4 className="mb-2 text-sm font-semibold text-text">
            Sélectionnés ({selected.length})
          </h4>
          {selected.length === 0 ? (
            <p className="text-sm text-text-muted">
              Aucun participant — vous pourrez en ajouter plus tard.
            </p>
          ) : (
            <ul className="space-y-2">
              {selected.map((p) => {
                const label = libelleProfil(p);
                return (
                  <li
                    key={p.profil_id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">
                        {label}
                      </p>
                      {p.email && label !== p.email ? (
                        <p className="truncate text-xs text-text-muted">{p.email}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      aria-label={`Retirer ${label}`}
                      onClick={() => removeProfil(p.profil_id)}
                    >
                      <UserMinus className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
