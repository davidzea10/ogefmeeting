import type { Direction, Profil, ReunionDetail } from '@ogefmeeting/shared';
import { libelleFonction } from '@ogefmeeting/shared';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  construireLignesParticipantsCr,
  participantsTableHtml,
  type LigneParticipantCr,
} from '@/lib/cr-prefill';
import { Button } from '@/components/ui/Button';

type CrParticipantsTableProps = {
  reunion: ReunionDetail;
  profils: Profil[];
  directions: Direction[];
  /** Contenu HTML actuel (section participants) */
  valueHtml?: string;
  /** Profils exclus du CR (persistés dans le contenu). */
  exclusIds?: string[];
  editable?: boolean;
  onChange?: (html: string, exclusIds: string[]) => void;
};

/**
 * Tableau structuré des participants pour le CR :
 * Nom, Fonction, Matricule, Email, Direction, Statut — tri hiérarchique.
 */
export function CrParticipantsTable({
  reunion,
  profils,
  directions,
  valueHtml,
  exclusIds: exclusIdsProp = [],
  editable = true,
  onChange,
}: CrParticipantsTableProps) {
  const [exclusIds, setExclusIds] = useState<string[]>(exclusIdsProp);

  useEffect(() => {
    setExclusIds(exclusIdsProp);
  }, [exclusIdsProp]);

  const toutesLignes = useMemo(
    () => construireLignesParticipantsCr(reunion, profils, directions),
    [reunion, profils, directions],
  );

  const lignes = useMemo(
    () => toutesLignes.filter((l) => !exclusIds.includes(l.profil_id)),
    [toutesLignes, exclusIds],
  );

  const htmlGenere = participantsTableHtml(lignes);

  useEffect(() => {
    if (editable && onChange && htmlGenere !== valueHtml) {
      onChange(htmlGenere, exclusIds);
    }
  }, [editable, onChange, htmlGenere, valueHtml, exclusIds]);

  function retirer(profilId: string) {
    const next = [...new Set([...exclusIds, profilId])];
    setExclusIds(next);
    const filtered = toutesLignes.filter((l) => !next.includes(l.profil_id));
    onChange?.(participantsTableHtml(filtered), next);
  }

  function reinitialiser() {
    setExclusIds([]);
    onChange?.(participantsTableHtml(toutesLignes), []);
  }

  return (
    <div className="space-y-3">
      {editable && exclusIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            {exclusIds.length} participant{exclusIds.length > 1 ? 's' : ''} retiré
            {exclusIds.length > 1 ? 's' : ''} du compte rendu.
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={reinitialiser}>
            Réintégrer tous
          </Button>
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
                  <span className="sr-only">Actions</span>
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
              lignes.map((l: LigneParticipantCr, i) => (
                <tr
                  key={l.profil_id}
                  className={i % 2 === 0 ? 'bg-surface-muted/30' : ''}
                >
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
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                        onClick={() => retirer(l.profil_id)}
                        aria-label={`Retirer ${l.nom} du compte rendu`}
                        title="Retirer du compte rendu"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editable && (
        <p className="text-xs text-text-muted">
          Tri hiérarchique : Directeur → Sous-directeur → Chef de service → Agent.
          Retirer un participant l’enlève du CR et du PDF (pas de la réunion).
        </p>
      )}
    </div>
  );
}
