import type { Direction, Profil, ReunionDetail } from '@ogefmeeting/shared';
import { libelleFonction } from '@ogefmeeting/shared';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  construireLignesParticipantsCr,
  participantsTableHtml,
  type LigneParticipantCr,
  type ParticipantCrOverride,
} from '@/lib/cr-prefill';
import { LIBELLES_PARTICIPANT } from '@/lib/labels';
import { Button } from '@/components/ui/Button';

type Overrides = Record<string, ParticipantCrOverride>;

type CrParticipantsTableProps = {
  reunion: ReunionDetail;
  profils: Profil[];
  directions: Direction[];
  valueHtml?: string;
  exclusIds?: string[];
  overrides?: Overrides;
  editable?: boolean;
  onChange?: (
    html: string,
    exclusIds: string[],
    overrides: Overrides,
  ) => void;
};

/**
 * Tableau structuré des participants pour le CR :
 * Nom, Fonction, Matricule, Email, Direction, Statut — tri hiérarchique.
 * L’organisateur peut retirer, réintégrer et modifier nom / statut / fonction affichés.
 */
export function CrParticipantsTable({
  reunion,
  profils,
  directions,
  valueHtml,
  exclusIds: exclusIdsProp = [],
  overrides: overridesProp = {},
  editable = true,
  onChange,
}: CrParticipantsTableProps) {
  const [exclusIds, setExclusIds] = useState<string[]>(exclusIdsProp);
  const [overrides, setOverrides] = useState<Overrides>(overridesProp);
  const [editionId, setEditionId] = useState<string | null>(null);

  useEffect(() => {
    setExclusIds(exclusIdsProp);
  }, [exclusIdsProp]);

  useEffect(() => {
    setOverrides(overridesProp);
  }, [overridesProp]);

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
        statut: o.statut?.trim() || l.statut,
        fonction: o.fonction !== undefined ? o.fonction : l.fonction,
      };
    });
  }

  const lignesAppliquees = useMemo(
    () => appliquerOverrides(toutesLignes, overrides),
    [toutesLignes, overrides],
  );

  const lignes = useMemo(
    () => lignesAppliquees.filter((l) => !exclusIds.includes(l.profil_id)),
    [lignesAppliquees, exclusIds],
  );

  const exclusLignes = useMemo(
    () => lignesAppliquees.filter((l) => exclusIds.includes(l.profil_id)),
    [lignesAppliquees, exclusIds],
  );

  const htmlGenere = participantsTableHtml(lignes);

  useEffect(() => {
    if (editable && onChange && htmlGenere !== valueHtml) {
      onChange(htmlGenere, exclusIds, overrides);
    }
  }, [editable, onChange, htmlGenere, valueHtml, exclusIds, overrides]);

  function push(nextExclus: string[], nextOverrides: Overrides) {
    setExclusIds(nextExclus);
    setOverrides(nextOverrides);
    const rebuilt = appliquerOverrides(toutesLignes, nextOverrides).filter(
      (l) => !nextExclus.includes(l.profil_id),
    );
    onChange?.(participantsTableHtml(rebuilt), nextExclus, nextOverrides);
  }

  function retirer(profilId: string) {
    push([...new Set([...exclusIds, profilId])], overrides);
    if (editionId === profilId) setEditionId(null);
  }

  function reintegrer(profilId: string) {
    push(
      exclusIds.filter((id) => id !== profilId),
      overrides,
    );
  }

  function reinitialiser() {
    push([], {});
    setEditionId(null);
  }

  function sauvegarderEdition(ligne: LigneParticipantCr, form: HTMLFormElement) {
    const fd = new FormData(form);
    const nom = String(fd.get('nom') ?? '').trim();
    const statut = String(fd.get('statut') ?? '').trim();
    const fonction = String(fd.get('fonction') ?? '').trim();
    const next = {
      ...overrides,
      [ligne.profil_id]: {
        nom: nom || ligne.nom,
        statut: statut || ligne.statut,
        fonction: fonction || null,
      },
    };
    push(exclusIds, next);
    setEditionId(null);
  }

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
                  <option value="">Ajouter un participant…</option>
                  {exclusLignes.map((l) => (
                    <option key={l.profil_id} value={l.profil_id}>
                      {l.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {(exclusIds.length > 0 || Object.keys(overrides).length > 0) && (
            <Button type="button" size="sm" variant="ghost" onClick={reinitialiser}>
              Réinitialiser la liste
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-ogefrem-blue/10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Nom</th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">
                Fonction
              </th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">
                Matricule
              </th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Email</th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">
                Direction
              </th>
              <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Statut</th>
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
                  colSpan={editable ? 7 : 6}
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
                    <td colSpan={7} className="px-3 py-3">
                      <form
                        className="grid gap-2 sm:grid-cols-4"
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
                        />
                        <select
                          name="fonction"
                          defaultValue={l.fonction ?? ''}
                          className="h-9 rounded-lg border border-border px-2 text-sm"
                          aria-label="Fonction"
                        >
                          <option value="">—</option>
                          <option value="directeur">Directeur</option>
                          <option value="sous_directeur">Sous-directeur</option>
                          <option value="chef_service">Chef de service</option>
                          <option value="agent">Agent</option>
                        </select>
                        <select
                          name="statut"
                          defaultValue={l.statut}
                          className="h-9 rounded-lg border border-border px-2 text-sm"
                          aria-label="Statut"
                        >
                          {Object.values(LIBELLES_PARTICIPANT).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
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
                        {libelleFonction(l.fonction)}
                      </td>
                      <td className="px-3 py-2 text-text-muted">{l.matricule}</td>
                      <td className="px-3 py-2 text-text-muted">{l.email}</td>
                      <td className="px-3 py-2 font-medium text-text">{l.direction}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-ogefrem-blue/10 px-2 py-0.5 text-xs font-medium text-ogefrem-blue">
                          {l.statut}
                        </span>
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
                              onClick={() => retirer(l.profil_id)}
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
        <p className="text-xs text-text-muted">
          <Plus className="mr-1 inline h-3 w-3" aria-hidden />
          Tri hiérarchique. Retirer / ajouter / modifier n’affecte que le compte rendu
          (pas la liste d’invitation de la réunion).
        </p>
      )}
    </div>
  );
}
