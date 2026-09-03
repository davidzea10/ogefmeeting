import { useAuthStore } from '@/stores/auth.store';
import { peutAccederAdministration, peutGererMembresDirection } from '@/lib/roles';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Auth obligatoire par défaut.
 * Désactiver uniquement avec VITE_AUTH_REQUIRED=false.
 */
const AUTH_REQUIRED = import.meta.env.VITE_AUTH_REQUIRED !== 'false';

export function RequireAuth() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (AUTH_REQUIRED && !isAuthenticated()) {
    return (
      <Navigate
        to="/connexion"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

/** Redirige vers l'accueil si déjà connecté (pages auth) */
export function GuestOnly() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/** Accès Administration / Utilisateurs — admin uniquement */
export function RequireAdmin() {
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  if (!peutAccederAdministration(role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** Gestion des membres de direction — admin, directeur ou sous-directeur */
export function RequireGestionDirection() {
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? profil?.role ?? null);
  if (!peutGererMembresDirection(role, profil?.fonction, profil?.direction_id)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
