import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ReunionFormValues } from '@/schemas/reunion-form.schema';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';

type Props = {
  watch: UseFormWatch<ReunionFormValues>;
  setValue: UseFormSetValue<ReunionFormValues>;
};

export function StepOrdreJour({ watch, setValue }: Props) {
  const points = watch('points');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [duree, setDuree] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addPoint() {
    const t = titre.trim();
    if (t.length < 2) {
      setError('Le titre du point doit contenir au moins 2 caractères.');
      return;
    }
    setError(null);
    setValue(
      'points',
      [
        ...points,
        {
          id: crypto.randomUUID(),
          titre: t,
          description: description.trim(),
          duree_minutes: duree ? Number(duree) : null,
        },
      ],
      { shouldDirty: true },
    );
    setTitre('');
    setDescription('');
    setDuree('');
  }

  function removeAt(index: number) {
    setValue(
      'points',
      points.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...points];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setValue('points', next, { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-text">Ajouter un point</h4>
        <Input
          label="Titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          error={error ?? undefined}
        />
        <Input
          label="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          label="Durée (minutes)"
          type="number"
          min={1}
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={addPoint}>
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter le point
        </Button>
      </div>

      <ol className="space-y-2" aria-label="Ordre du jour">
        {points.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
            Aucun point pour l’instant.
          </li>
        )}
        {points.map((point, index) => (
          <li
            key={point.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ogefrem-blue/10 text-sm font-bold text-ogefrem-blue">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text">{point.titre}</p>
              {point.description && (
                <p className="text-sm text-text-muted">{point.description}</p>
              )}
              {point.duree_minutes && (
                <p className="text-xs text-text-muted">{point.duree_minutes} min</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Monter"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Descendre"
                disabled={index === points.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Supprimer"
                onClick={() => removeAt(index)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
