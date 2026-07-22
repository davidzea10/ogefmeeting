import { formatDateHeure, formatDirection, LIBELLES_TYPE } from '@/lib/labels';
import type { ReunionFormValues } from '@/schemas/reunion-form.schema';
import { toDatePrevueISO } from '@/schemas/reunion-form.schema';
import type { Direction, ModeleCompteRendu } from '@ogefmeeting/shared';
import type { UseFormRegister, UseFormWatch } from 'react-hook-form';

const selectClass =
  'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25';

type Props = {
  watch: UseFormWatch<ReunionFormValues>;
  register: UseFormRegister<ReunionFormValues>;
  directions: Direction[];
  modeles: ModeleCompteRendu[];
};

export function StepConfirmation({ watch, register, directions, modeles }: Props) {
  const values = watch();
  const direction = directions.find((d) => d.id === values.direction_id);

  let dateLabel = '—';
  try {
    if (values.date && values.heure) {
      dateLabel = formatDateHeure(toDatePrevueISO(values.date, values.heure));
    }
  } catch {
    dateLabel = `${values.date} ${values.heure}`;
  }

  return (
    <div className="space-y-6">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-text">Modèle de compte rendu</span>
        <select className={selectClass} {...register('modele_id')}>
          <option value="">— Par défaut / aucun —</option>
          {modeles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
              {m.est_par_defaut ? ' (défaut)' : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-border bg-surface-muted/40 p-5 space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Récapitulatif
        </h4>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Titre</dt>
            <dd className="font-semibold text-text">{values.titre || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Type</dt>
            <dd className="font-semibold text-text">
              {LIBELLES_TYPE[values.type_reunion]}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Date & heure</dt>
            <dd className="font-semibold text-text">{dateLabel}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Lieu</dt>
            <dd className="font-semibold text-text">{values.lieu || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Direction</dt>
            <dd className="font-semibold text-text">
              {direction ? formatDirection(direction) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Participants</dt>
            <dd className="font-semibold text-text">{values.participants.length}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-text-muted">Ordre du jour</dt>
            <dd className="font-semibold text-text">
              {values.points.length === 0
                ? 'Aucun point'
                : values.points.map((p) => p.titre).join(' · ')}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
