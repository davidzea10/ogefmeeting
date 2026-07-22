import { cn } from '@/lib/cn';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Fil d'Ariane" className={cn('flex items-center gap-1 text-sm', className)}>
      <Link
        to="/"
        className="flex items-center text-text-muted transition-colors hover:text-ogefrem-blue"
        aria-label="Accueil"
      >
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-border-strong" aria-hidden />
          {item.href ? (
            <Link to={item.href} className="text-text-muted hover:text-ogefrem-blue">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-text" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
