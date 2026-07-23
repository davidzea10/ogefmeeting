import { cn } from '@/lib/cn';
import {
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}[] = [
  { to: '/', label: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/reunions', label: 'Réunions', icon: CalendarDays },
  { to: '/comptes-rendus', label: 'CR', icon: FileText },
  { to: '/actions', label: 'Actions', icon: CheckSquare },
  { to: '/profil', label: 'Plus', icon: MoreHorizontal },
];

/** Barre de navigation bas — style application mobile (iPhone / Android). */
export function MobileBottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      aria-label="Navigation mobile"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition',
                  'min-h-12 focus-visible:ring-2 focus-visible:ring-ogefrem-blue',
                  isActive
                    ? 'text-ogefrem-blue'
                    : 'text-text-muted hover:text-text',
                )
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isActive && 'bg-ogefrem-blue/10',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
