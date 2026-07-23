import { cn } from '@/lib/cn';
import { formatDateHeure } from '@/lib/labels';
import type { Reunion } from '@ogefmeeting/shared';
import { CheckCircle2, Circle, PlayCircle, Archive, Hourglass, XCircle } from 'lucide-react';

type Props = {
  reunion: Reunion;
};

type Step = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  date?: string | null;
  icon: typeof Circle;
};

export function ReunionTimeline({ reunion }: Props) {
  const refusee = reunion.statut === 'refusee';
  const enAttente = reunion.statut === 'en_attente_validation';

  const steps: Step[] = [
    {
      key: 'proposition',
      label: enAttente || refusee ? 'Proposition' : 'Planifiée',
      done: true,
      active: enAttente || reunion.statut === 'planifiee',
      date: reunion.cree_le,
      icon: enAttente ? Hourglass : Circle,
    },
    {
      key: 'en_cours',
      label: 'En cours',
      done: ['en_cours', 'cloturee', 'archivee'].includes(reunion.statut),
      active: reunion.statut === 'en_cours',
      date: reunion.date_debut,
      icon: PlayCircle,
    },
    {
      key: 'cloturee',
      label: refusee ? 'Refusée' : 'Clôturée',
      done: ['cloturee', 'archivee', 'refusee'].includes(reunion.statut),
      active: reunion.statut === 'cloturee' || refusee,
      date: reunion.date_fin,
      icon: refusee ? XCircle : CheckCircle2,
    },
    {
      key: 'archivee',
      label: 'Archivée',
      done: reunion.statut === 'archivee',
      active: reunion.statut === 'archivee',
      date: reunion.statut === 'archivee' ? reunion.modifie_le : null,
      icon: Archive,
    },
  ];

  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      aria-label="Déroulement de la réunion"
    >
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
        Timeline
      </h3>
      <ol className="relative grid gap-4 sm:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.key} className="relative flex flex-col items-start gap-2">
              {index < steps.length - 1 && (
                <span
                  className={cn(
                    'absolute top-4 left-8 hidden h-0.5 w-[calc(100%-1rem)] sm:block',
                    step.done ? 'bg-ogefrem-blue' : 'bg-border',
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full',
                  step.active && 'bg-ogefrem-yellow text-ogefrem-navy ring-4 ring-ogefrem-yellow/30',
                  step.done && !step.active && 'bg-ogefrem-blue text-white',
                  !step.done && !step.active && 'bg-surface-muted text-text-muted',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    step.active ? 'text-ogefrem-blue' : 'text-text',
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-text-muted">
                  {step.date ? formatDateHeure(step.date) : '—'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
