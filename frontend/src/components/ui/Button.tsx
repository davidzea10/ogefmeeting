import { cn } from '@/lib/cn';
import { Check, Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

const variants = {
  primary:
    'bg-ogefrem-blue text-white hover:bg-ogefrem-blue-dark active:scale-[0.98] shadow-sm hover:shadow-md',
  secondary:
    'bg-ogefrem-yellow text-ogefrem-navy hover:bg-ogefrem-yellow-light active:scale-[0.98] shadow-sm',
  outline:
    'border-2 border-ogefrem-blue text-ogefrem-blue bg-transparent hover:bg-ogefrem-blue/5',
  ghost: 'text-ogefrem-blue hover:bg-ogefrem-blue/8 bg-transparent',
  danger: 'bg-danger text-white hover:bg-red-800 active:scale-[0.98]',
} as const;

const sizes = {
  sm: 'min-h-9 h-9 px-3.5 text-sm gap-1.5',
  md: 'min-h-11 h-11 px-5 text-sm gap-2',
  lg: 'min-h-12 h-12 px-6 text-base gap-2',
  icon: 'min-h-11 min-w-11 h-11 w-11 p-0',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  success?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  success,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:ring-2 focus-visible:ring-ogefrem-blue focus-visible:ring-offset-2',
        success ? 'bg-success text-white shadow-sm' : variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {!loading && success && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  );
}
