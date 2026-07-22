import { cn } from '@/lib/cn';

type LogoProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
};

const sizes = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-20',
};

export function Logo({ className, size = 'md', showText = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/brand/logo-ogefrem.jpg"
        alt="OGEFREM"
        className={cn('w-auto rounded-lg object-contain shadow-md', sizes[size])}
      />
      {showText && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ogefrem-yellow">
            OGEFREM
          </p>
          <p className="text-lg font-bold text-white">Ogefmeeting</p>
        </div>
      )}
    </div>
  );
}
