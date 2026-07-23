import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { apiDeconnexion } from '@/lib/auth-api';
import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { LogOut, Menu, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type AppHeaderProps = {
  title?: string;
};

export function AppHeader({ title = 'Tableau de bord' }: AppHeaderProps) {
  const navigate = useNavigate();
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const mobileSidebarOpen = useUiStore((s) => s.mobileSidebarOpen);
  const { accessToken, profil, user, clearSession } = useAuthStore();
  const announce = useAnnouncerStore((s) => s.announce);
  const [mobileSearch, setMobileSearch] = useState(false);

  const displayName = profil
    ? `${profil.prenom} ${profil.nom}`
    : user?.email ?? 'Invité';

  async function handleLogout() {
    await apiDeconnexion(accessToken);
    clearSession();
    announce('Vous êtes déconnecté.');
    navigate('/connexion');
  }

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      role="banner"
    >
      <div className="flex h-[var(--header-height)] items-center gap-2 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-text-muted hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ogefrem-blue lg:hidden"
          aria-label="Ouvrir le menu de navigation"
          aria-expanded={mobileSidebarOpen}
          aria-controls="sidebar-mobile"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 md:flex-none md:max-w-[12rem] lg:max-w-[16rem]">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-text sm:text-lg">
            {title}
          </h1>
        </div>

        <GlobalSearch className="hidden flex-1 md:block" />

        <div
          className="flex items-center gap-1 sm:gap-2"
          role="group"
          aria-label="Actions utilisateur"
        >
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Recherche"
            aria-expanded={mobileSearch}
            onClick={() => setMobileSearch((v) => !v)}
          >
            <Search className="h-5 w-5" aria-hidden />
          </Button>

          <NotificationBell />

          {accessToken ? (
            <>
              <Link
                to="/profil"
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ogefrem-blue"
                aria-label={`Profil de ${displayName}`}
              >
                <Avatar name={displayName} src={profil?.url_avatar} size="sm" />
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-text sm:inline">
                  {displayName}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Se déconnecter"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-5 w-5" aria-hidden />
              </Button>
            </>
          ) : (
            <Link to="/connexion">
              <Button size="sm" variant="secondary">
                Connexion
              </Button>
            </Link>
          )}
        </div>
      </div>

      {mobileSearch && (
        <div className="border-t border-border px-3 py-2 md:hidden">
          <GlobalSearch alwaysVisible className="max-w-none" />
        </div>
      )}
    </header>
  );
}
