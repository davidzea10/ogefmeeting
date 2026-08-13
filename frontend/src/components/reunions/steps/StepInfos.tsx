import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDirection, LIBELLES_TYPE } from '@/lib/labels';
import { TYPES_REUNION, type Direction } from '@ogefmeeting/shared';
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import type { ReunionFormValues } from '@/schemas/reunion-form.schema';

const selectClass =
  'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25';

type Props = {
  register: UseFormRegister<ReunionFormValues>;
  watch: UseFormWatch<ReunionFormValues>;
  setValue: UseFormSetValue<ReunionFormValues>;
  errors: FieldErrors<ReunionFormValues>;
  directions: Direction[];
};

export function StepInfos({ register, watch, setValue, errors, directions }: Props) {
  const multiDirection = watch('multi_direction');
  const selectedDirections = watch('direction_ids');

  const directionMultiError =
    typeof errors.direction_ids?.message === 'string' ? errors.direction_ids.message : undefined;

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
          <div className="rounded-lg border border-border p-3">
            <label className="mb-3 flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                className="h-4 w-4 accent-ogefrem-blue"
                checked={multiDirection}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setValue('multi_direction', checked, { shouldDirty: true });
                  if (checked) {
                    const single = watch('direction_id');
                    setValue('direction_ids', single ? [single] : [], { shouldDirty: true });
                  } else {
                    const first = selectedDirections[0] ?? '';
                    setValue('direction_id', first, { shouldDirty: true });
                  }
                }}
              />
              Réunion multi-direction
            </label>

            {!multiDirection ? (
              <select className={selectClass} {...register('direction_id')}>
                <option value="">— Aucune —</option>
                {directions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDirection(d)}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  className={selectClass}
                  multiple
                  value={selectedDirections}
                  onChange={(e) => {
                    const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setValue('direction_ids', ids, { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  {directions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDirection(d)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-muted">
                  Astuce: Ctrl/Cmd + clic pour sélectionner plusieurs directions.
                </p>
                {directionMultiError && (
                  <p className="mt-1 text-xs text-danger">{directionMultiError}</p>
                )}
              </>
            )}
          </div>
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
