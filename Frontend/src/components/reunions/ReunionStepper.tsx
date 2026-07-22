import { cn } from '@/lib/cn';
import { easeOutExpo, useMotionSafe } from '@/lib/motion';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export type StepDef = {
  id: number;
  label: string;
  description: string;
};

type Props = {
  steps: StepDef[];
  current: number;
  onStepClick?: (step: number) => void;
};

export function ReunionStepper({ steps, current, onStepClick }: Props) {
  const motionSafe = useMotionSafe();

  return (
    <nav aria-label="Étapes du formulaire" className="w-full">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = onStepClick && index <= current;

          return (
            <li key={step.id} className="flex flex-1 items-start gap-3">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(index)}
                className={cn(
                  'flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left transition',
                  clickable && 'hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ogefrem-blue',
                  !clickable && 'cursor-default',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <motion.span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    done && 'bg-success text-white',
                    active && 'bg-ogefrem-blue text-white',
                    !done && !active && 'bg-surface-muted text-text-muted',
                  )}
                  animate={
                    motionSafe && active
                      ? { scale: [1, 1.06, 1] }
                      : undefined
                  }
                  transition={{ duration: 0.4, ease: easeOutExpo }}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </motion.span>
                <span className="min-w-0 pt-1.5">
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      active ? 'text-ogefrem-blue' : 'text-text',
                    )}
                  >
                    {step.label}
                  </span>
                  {step.description ? (
                    <span className="hidden text-xs text-text-muted md:block">
                      {step.description}
                    </span>
                  ) : null}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className="mt-4 hidden h-px flex-1 bg-border sm:block"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
