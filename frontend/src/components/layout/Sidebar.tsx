import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { easeOutExpo, useMotionSafe } from '@/lib/motion';
import { useUiStore } from '@/stores/ui.store';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  Palette,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useCallback } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/reunions', label: 'Réunions', icon: CalendarDays },
  { to: '/comptes-rendus', label: 'Comptes rendus', icon: FileText },
  { to: '/actions', label: 'Actions', icon: CheckSquare },
  { to: '/recherche', label: 'Recherche', icon: Search },
  { to: '/archives', label: 'Archives', icon: Archive },
  { to: '/utilisateurs', label: 'Utilisateurs', icon: Users },
  { to: '/design-system', label: 'Design system', icon: Palette },
  { to: '/administration', label: 'Administration', icon: Settings },
];

function SidebarContent({
  collapsed,
  id,
}: {
  collapsed: boolean;
  id?: string;
}) {
  const { toggleSidebar, setMobileSidebarOpen } = useUiStore();
  const motionSafe = useMotionSafe();

  return (
    <motion.aside
      id={id}
      className="flex h-full flex-col border-r border-white/10 bg-ogefrem-navy text-white"
      aria-label="Menu latéral"
      animate={{
        width: collapsed
          ? 'var(--sidebar-collapsed-width)'
          : 'var(--sidebar-width)',
      }}
      transition={
        motionSafe
          ? { duration: 0.28, ease: easeOutExpo }
          : { duration: 0 }
      }
    >
      <div className="flex h-[var(--header-height)] items-center justify-between gap-2 border-b border-white/10 px-3">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="logo"
              initial={motionSafe ? { opacity: 0, width: 0 } : false}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <Logo size="sm" />
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-white/80 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ogefrem-yellow lg:flex"
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          aria-expanded={!collapsed}
          aria-controls="nav-principale"
        >
          <ChevronLeft
            className={cn(
              'h-5 w-5 transition-transform duration-300',
              collapsed && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-white/80 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ogefrem-yellow lg:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <nav
        id="nav-principale"
        className="flex-1 space-y-1 overflow-y-auto p-3"
        aria-label="Navigation principale"
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMobileSidebarOpen(false)}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                'group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                'focus-visible:ring-2 focus-visible:ring-ogefrem-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ogefrem-navy',
                isActive
                  ? 'bg-ogefrem-yellow text-ogefrem-navy shadow-md'
                  : 'text-white/90 hover:bg-white/10 hover:text-white',
              )
            }
            title={collapsed ? label : undefined}
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      initial={motionSafe ? { opacity: 0, x: -6 } : false}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="truncate"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {collapsed && <span className="sr-only">{label}</span>}
                {isActive && <span className="sr-only">(page courante)</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className={cn('text-xs text-white/70', collapsed && 'sr-only')}>
          Qualité 6I · Interactive · Impeccable
        </p>
      </div>
    </motion.aside>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useUiStore();
  const motionSafe = useMotionSafe();

  const closeMobile = useCallback(() => setMobileSidebarOpen(false), [setMobileSidebarOpen]);
  const trapRef = useFocusTrap(mobileSidebarOpen, closeMobile);

  return (
    <>
      <div className="hidden shrink-0 lg:block">
        <SidebarContent collapsed={sidebarCollapsed} />
      </div>

      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: motionSafe ? 0.2 : 0 }}
              className="fixed inset-0 z-40 bg-ogefrem-navy/60 backdrop-blur-sm lg:hidden"
              onClick={closeMobile}
              aria-hidden
            />
            <motion.div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={
                motionSafe
                  ? { type: 'spring', damping: 28, stiffness: 320 }
                  : { duration: 0 }
              }
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <SidebarContent collapsed={false} id="sidebar-mobile" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
