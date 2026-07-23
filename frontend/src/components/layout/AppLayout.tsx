import { SkipLink } from '@/components/a11y/SkipLink';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTransition } from '@/components/motion/PageTransition';
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-surface-muted">
      <SkipLink />
      <Sidebar />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <AppHeader />
        <main
          id="contenu-principal"
          tabIndex={-1}
          className="flex-1 overflow-x-hidden px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pt-4 lg:p-6 lg:pb-6"
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        <div className="hidden lg:block">
          <AppFooter />
        </div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
