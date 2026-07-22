import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { apiDeconnexion } from '@/lib/auth-api';
import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { Bell, LogOut, Menu, Search } from 'lucide-react';
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
      className="sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur-md sm:gap-4 sm:px-4 lg:px-6"
      role="banner"
    >
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

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-text sm:text-lg">{title}</h1>
      </div>

      <div className="hidden max-w-md flex-1 md:block">
        <label className="sr-only" htmlFor="recherche-rapide">
          Recherche rapide
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            id="recherche-rapide"
            type="search"
            placeholder="Rechercher une réunion, un CR..."
            className={cn(
              'h-11 w-full rounded-lg border border-border bg-surface-muted pl-10 text-sm',
              'placeholder:text-text-muted focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25',
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2" role="group" aria-label="Actions utilisateur">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden />
        </Button>

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
    </header>
  );
}
