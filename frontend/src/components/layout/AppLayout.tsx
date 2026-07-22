import { SkipLink } from '@/components/a11y/SkipLink';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTransition } from '@/components/motion/PageTransition';
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-surface-muted">
      <SkipLink />
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader />
        <main
          id="contenu-principal"
          tabIndex={-1}
          className="flex-1 p-3 sm:p-4 lg:p-6"
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
