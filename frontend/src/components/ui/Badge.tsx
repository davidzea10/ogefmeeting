import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

const variants = {
  default: 'bg-ogefrem-blue/10 text-ogefrem-blue border-ogefrem-blue/20',
  yellow: 'bg-ogefrem-yellow/20 text-ogefrem-navy border-ogefrem-yellow/40',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  neutral: 'bg-surface-muted text-text-muted border-border',
} as const;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
