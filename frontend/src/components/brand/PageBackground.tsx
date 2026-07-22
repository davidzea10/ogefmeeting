import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type PageBackgroundProps = HTMLAttributes<HTMLDivElement> & {
  overlay?: 'light' | 'dark' | 'gradient';
  children?: React.ReactNode;
};

export function PageBackground({
  className,
  overlay = 'gradient',
  children,
  ...props
}: PageBackgroundProps) {
  const overlayClass = {
    light: 'bg-white/75',
    dark: 'bg-ogefrem-navy/80',
    gradient:
      'bg-gradient-to-br from-ogefrem-navy/90 via-ogefrem-blue-dark/85 to-ogefrem-blue/75',
  }[overlay];

  return (
    <div className={cn('relative min-h-screen overflow-hidden', className)} {...props}>
      <img
        src="/brand/arriere-plan.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className={cn('absolute inset-0', overlayClass)} aria-hidden />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}
