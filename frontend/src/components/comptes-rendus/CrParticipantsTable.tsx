import type { Direction, Profil, ReunionDetail } from '@ogefmeeting/shared';
import { libelleFonction } from '@ogefmeeting/shared';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  construireLignesParticipantsCr,
  lignesExternesVersCr,
  participantsTableHtml,
  type LigneParticipantCr,
  type ParticipantCrOverride,
  type ParticipantExterneCr,
} from '@/lib/cr-prefill';
import { Button } from '@/components/ui/Button';

type Overrides = Record<string, ParticipantCrOverride>;

type CrParticipantsTableProps = {
  reunion: ReunionDetail;
  profils: Profil[];
  directions: Direction[];
  valueHtml?: string;
  exclusIds?: string[];
  overrides?: Overrides;
  externes?: ParticipantExterneCr[];
  editable?: boolean;
  onChange?: (
    html: string,
    exclusIds: string[],
    overrides: Overrides,
    externes: ParticipantExterneCr[],
  ) => void;
};

function nouveauIdExterne(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `ext-${crypto.randomUUID()}`;
  }
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function libelleFonctionLigne(l: LigneParticipantCr): string {
  if (l.externe) return l.fonction?.trim() || '—';
  return libelleFonction(l.fonction);
}

/**
 * Tableau structuré des participants pour le CR :
 * Nom, Fonction, Email, Direction — édition manuelle de tous les champs.
 */
export function CrParticipantsTable({
  reunion,
  profils,
  directions,
  valueHtml,
  exclusIds: exclusIdsProp = [],
  overrides: overridesProp = {},
  externes: externesProp = [],
  editable = true,
  onChange,
}: CrParticipantsTableProps) {
  const [exclusIds, setExclusIds] = useState<string[]>(exclusIdsProp);
  const [overrides, setOverrides] = useState<Overrides>(overridesProp);
  const [externes, setExternes] = useState<ParticipantExterneCr[]>(externesProp);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [formExterneOuvert, setFormExterneOuvert] = useState(false);

  useEffect(() => {
    setExclusIds(exclusIdsProp);
  }, [exclusIdsProp]);

  useEffect(() => {
    setOverrides(overridesProp);
  }, [overridesProp]);

  useEffect(() => {
    setExternes(externesProp);
  }, [externesProp]);

  const toutesLignes = useMemo(
    () => construireLignesParticipantsCr(reunion, profils, directions),
    [reunion, profils, directions],
  );

  function appliquerOverrides(
    source: LigneParticipantCr[],
    nextOverrides: Overrides,
  ): LigneParticipantCr[] {
    return source.map((l) => {
      const o = nextOverrides[l.profil_id];
      if (!o) return l;
      return {
        ...l,
        nom: o.nom?.trim() || l.nom,
        fonction: o.fonction !== undefined ? o.fonction : l.fonction,
        email: o.email?.trim() || l.email,
        direction: o.direction !== undefined ? o.direction : l.direction,
      };
    });
  }

  function lignesCompletes(
    nextExclus: string[],
    nextOverrides: Overrides,
    nextExternes: ParticipantExterneCr[],
  ): LigneParticipantCr[] {
    const internes = appliquerOverrides(toutesLignes, nextOverrides).filter(
      (l) => !nextExclus.includes(l.profil_id),
    );
    return [...internes, ...lignesExternesVersCr(nextExternes)];
  }

  const lignes = useMemo(
    () => lignesCompletes(exclusIds, overrides, externes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toutesLignes, exclusIds, overrides, externes],
  );

  const exclusLignes = useMemo(
    () =>
      appliquerOverrides(toutesLignes, overrides).filter((l) =>
        exclusIds.includes(l.profil_id),
      ),
    [toutesLignes, overrides, exclusIds],
  );

  const htmlGenere = participantsTableHtml(lignes);

  useEffect(() => {
    if (editable && onChange && htmlGenere !== valueHtml) {
      onChange(htmlGenere, exclusIds, overrides, externes);
    }
  }, [editable, onChange, htmlGenere, valueHtml, exclusIds, overrides, externes]);

  function push(
    nextExclus: string[],
    nextOverrides: Overrides,
    nextExternes: ParticipantExterneCr[],
  ) {
    setExclusIds(nextExclus);
    setOverrides(nextOverrides);
    setExternes(nextExternes);
    onChange?.(
      participantsTableHtml(lignesCompletes(nextExclus, nextOverrides, nextExternes)),
      nextExclus,
      nextOverrides,
      nextExternes,
    );
  }

  function retirer(ligne: LigneParticipantCr) {
    if (ligne.externe) {
      push(
        exclusIds,
        overrides,
        externes.filter((e) => e.id !== ligne.profil_id),
      );
    } else {
      push([...new Set([...exclusIds, ligne.profil_id])], overrides, externes);
    }
    if (editionId === ligne.profil_id) setEditionId(null);
  }

  function reintegrer(profilId: string) {
    push(
      exclusIds.filter((id) => id !== profilId),
      overrides,
      externes,
    );
  }

  function reinitialiser() {
    push([], {}, []);
    setEditionId(null);
    setFormExterneOuvert(false);
  }

  function sauvegarderEdition(ligne: LigneParticipantCr, form: HTMLFormElement) {
    const fd = new FormData(form);
    const nom = String(fd.get('nom') ?? '').trim();
    const fonction = String(fd.get('fonction') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const direction = String(fd.get('direction') ?? '').trim();

    if (ligne.externe) {
      const nextExternes = externes.map((e) =>
        e.id === ligne.profil_id
          ? {
              ...e,
              nom: nom || e.nom,
              fonction,
              email,
              direction,
            }
          : e,
      );
      push(exclusIds, overrides, nextExternes);
    } else {
      const next = {
        ...overrides,
        [ligne.profil_id]: {
          nom: nom || ligne.nom,
          fonction: fonction || null,
          email: email || ligne.email,
          direction,
        },
      };
      push(exclusIds, next, externes);
    }
    setEditionId(null);
  }

  function ajouterExterne(form: HTMLFormElement) {
    const fd = new FormData(form);
    const nom = String(fd.get('nom') ?? '').trim();
    const fonction = String(fd.get('fonction') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const direction = String(fd.get('direction') ?? '').trim();
    if (!nom) return;
    push(exclusIds, overrides, [
      ...externes,
      { id: nouveauIdExterne(), nom, fonction, email, direction },
    ]);
    setFormExterneOuvert(false);
    form.reset();
  }

  const colCount = editable ? 5 : 4;

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {exclusLignes.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-text">
                <UserPlus className="h-4 w-4 text-ogefrem-blue" aria-hidden />
                <span className="sr-only">Ajouter un participant retiré</span>
                <select
                  className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) reintegrer(id);
                    e.target.value = '';
                  }}
                  aria-label="Réintégrer un participant"
                >
                  <option value="">Réintégrer un participant OGEFREM…</option>
                  {exclusLignes.map((l) => (
                    <option key={l.profil_id} value={l.profil_id}>
                      {l.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setFormExterneOuvert((v) => !v)}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Ajouter un participant
            </Button>
          </div>
          {(exclusIds.length > 0 ||
            Object.keys(overrides).length > 0 ||
            externes.length > 0) && (
            <Button type="button" size="sm" variant="ghost" onClick={reinitialiser}>
              Réinitialiser la liste
            </Button>
          )}
        </div>
      )}

      {editable && formExterneOuvert && (
        <form
          className="grid gap-2 rounded-xl border border-ogefrem-blue/25 bg-ogefrem-blue/5 p-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            ajouterExterne(e.currentTarget);
          }}
        >
          <input
            name="nom"
            required
            placeholder="Nom complet *"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
            aria-label="Nom complet"
          />
          <input
            name="fonction"
            placeholder="Fonction"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
            aria-label="Fonction"
          />
          <input
            name="email"
            type="email"
            placeholder="E-mail"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
            aria-label="E-mail"
          />
          <input
            name="direction"
            placeholder="Direction (optionnel)"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
            aria-label="Direction"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Ajouter
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setFormExterneOuvert(false)}
            >
              Annuler
            </Button>
          </div>
          <p className="text-xs text-text-muted sm:col-span-5">
            Saisie manuelle (hors liste d’invitation) — la direction peut rester vide.
          </p>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-ogefrem-blue/10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Nom</th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">
                Fonction
              </th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">
                Direction
              </th>
              {editable && (
                <th className="px-3 py-2 text-right font-semibold text-ogefrem-blue">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {lignes.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-4 text-center text-text-muted"
                >
                  Aucun participant
                </td>
              </tr>
            ) : (
              lignes.map((l, i) => (
                <tr
                  key={l.profil_id}
                  className={i % 2 === 0 ? 'bg-surface-muted/30' : ''}
                >
                  {editionId === l.profil_id ? (
                    <td colSpan={colCount} className="px-3 py-3">
                      <form
                        className="grid gap-2 sm:grid-cols-5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          sauvegarderEdition(l, e.currentTarget);
                        }}
                      >
                        <input
                          name="nom"
                          defaultValue={l.nom}
                          className="h-9 rounded-lg border border-border px-2 text-sm"
                          aria-label="Nom"
                          placeholder="Nom"
                        />
                        <input
                          name="fonction"
                          defaultValue={l.fonction ?? ''}
                          className="h-9 rounded-lg border border-border px-2 text-sm"
                          aria-label="Fonction"
                          placeholder="Fonction (texte libre)"
                          list={l.externe ? undefined : 'cr-fonctions-suggestions'}
                        />
                        <input
                          name="email"
                          type="email"
                          defaultValue={l.email === '—' ? '' : l.email}
                          className="h-9 rounded-lg border border-border px-2 text-sm"
                          aria-label="E-mail"
                          placeholder="E-mail"
                        />
                        <input
                          name="direction"
                          defaultValue={l.direction}
                          className="h-9 rounded-lg border border-border px-2 text-sm"
                          aria-label="Direction"
                          placeholder="Direction"
                        />
                        <div className="flex gap-2">
                          <Button type="submit" size="sm">
                            Enregistrer
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditionId(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium text-text">{l.nom}</td>
                      <td className="px-3 py-2 text-text-muted">
                        {libelleFonctionLigne(l)}
                      </td>
                      <td className="px-3 py-2 text-text-muted">{l.email}</td>
                      <td className="px-3 py-2 font-medium text-text">
                        {l.direction || ''}
                      </td>
                      {editable && (
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ogefrem-blue hover:bg-ogefrem-blue/10"
                              onClick={() => setEditionId(l.profil_id)}
                              aria-label={`Modifier ${l.nom}`}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                              onClick={() => retirer(l)}
                              aria-label={`Retirer ${l.nom}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Retirer
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editable && (
        <>
          <datalist id="cr-fonctions-suggestions">
            <option value="directeur">Directeur</option>
            <option value="sous_directeur">Sous-directeur</option>
            <option value="chef_service">Chef de service</option>
            <option value="agent">Agent</option>
          </datalist>
          <p className="text-xs text-text-muted">
            <Plus className="mr-1 inline h-3 w-3" aria-hidden />
            Tous les champs (nom, fonction, e-mail, direction) sont modifiables à la
            main pour ce compte rendu uniquement.
          </p>
        </>
      )}
    </div>
  );
}
