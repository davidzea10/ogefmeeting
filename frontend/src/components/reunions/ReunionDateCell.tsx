import { Badge } from '@/components/ui/Badge';
import {
  formatDateHeure,
  joursRestantsAvantReunion,
  libelleJoursRestantsReunion,
} from '@/lib/labels';
import type { Reunion } from '@ogefmeeting/shared';

/** Date prévue + badge J-X pour les réunions planifiées. */
export function ReunionDateCell({ reunion }: { reunion: Reunion }) {
  const jours =
    reunion.statut === 'planifiee' ? joursRestantsAvantReunion(reunion.date_prevue) : null;

  return (
    <div className="space-y-1">
      <p className="whitespace-nowrap text-text-muted">{formatDateHeure(reunion.date_prevue)}</p>
      {jours !== null && (
        <Badge variant={jours <= 1 ? 'warning' : 'neutral'} className="text-[10px]">
          {libelleJoursRestantsReunion(jours)}
        </Badge>
      )}
      <p className="text-[11px] text-text-muted/80">
        Enregistrée le {formatDateHeure(reunion.cree_le)}
      </p>
    </div>
  );
}
