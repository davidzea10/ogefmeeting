import type { Direction, Profil, ReunionDetail } from '@ogefmeeting/shared';
import { useEffect } from 'react';
import {
  construireLignesParticipantsCr,
  participantsTableHtml,
} from '@/lib/cr-prefill';

type CrParticipantsTableProps = {
  reunion: ReunionDetail;
  profils: Profil[];
  directions: Direction[];
  /** Contenu HTML actuel (section participants) */
  valueHtml?: string;
  editable?: boolean;
  onChange?: (html: string) => void;
};

/**
 * Tableau structuré des participants pour le CR :
 * Nom, Matricule, Email, Direction (code), Statut.
 */
export function CrParticipantsTable({
  reunion,
  profils,
  directions,
  valueHtml,
  editable = true,
  onChange,
}: CrParticipantsTableProps) {
  const lignes = construireLignesParticipantsCr(reunion, profils, directions);
  const htmlGenere = participantsTableHtml(lignes);

  useEffect(() => {
    if (editable && onChange && htmlGenere !== valueHtml) {
      onChange(htmlGenere);
    }
  }, [editable, onChange, htmlGenere, valueHtml]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-ogefrem-blue/10">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Nom</th>
            <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Matricule</th>
            <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Email</th>
            <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Direction</th>
            <th className="px-3 py-2 text-left font-semibold text-ogefrem-blue">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {lignes.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center text-text-muted">
                Aucun participant
              </td>
            </tr>
          ) : (
            lignes.map((l, i) => (
              <tr key={`${l.nom}-${i}`} className={i % 2 === 0 ? 'bg-surface-muted/30' : ''}>
                <td className="px-3 py-2 font-medium text-text">{l.nom}</td>
                <td className="px-3 py-2 text-text-muted">{l.matricule}</td>
                <td className="px-3 py-2 text-text-muted">{l.email}</td>
                <td className="px-3 py-2 font-medium text-text">{l.direction}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-ogefrem-blue/10 px-2 py-0.5 text-xs font-medium text-ogefrem-blue">
                    {l.statut}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
