import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDirection, LIBELLES_TYPE } from '@/lib/labels';
import { TYPES_REUNION, type Direction } from '@ogefmeeting/shared';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { ReunionFormValues } from '@/schemas/reunion-form.schema';

const selectClass =
  'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25';

type Props = {
  register: UseFormRegister<ReunionFormValues>;
  errors: FieldErrors<ReunionFormValues>;
  directions: Direction[];
};

export function StepInfos({ register, errors, directions }: Props) {
  return (
    <div className="space-y-4">
      <Input
        label="Titre de la réunion"
        required
        error={errors.titre?.message}
        {...register('titre')}
      />

      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-text">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25"
          {...register('description')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text">
            Type <span className="text-danger">*</span>
          </span>
          <select className={selectClass} {...register('type_reunion')}>
            {TYPES_REUNION.map((t) => (
              <option key={t} value={t}>
                {LIBELLES_TYPE[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text">Direction</span>
          <select className={selectClass} {...register('direction_id')}>
            <option value="">— Aucune —</option>
            {directions.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDirection(d)}
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Date"
          type="date"
          required
          error={errors.date?.message}
          {...register('date')}
        />
        <Input
          label="Heure"
          type="time"
          required
          error={errors.heure?.message}
          {...register('heure')}
        />
      </div>

      <Input label="Lieu" placeholder="Salle DG, Visio…" {...register('lieu')} />
    </div>
  );
}

type NavProps = {
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
};

export function StepNav({ onNext, onBack, nextLabel = 'Continuer' }: NavProps) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          Retour
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
