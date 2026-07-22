import { useAuthStore } from '@/stores/auth.store';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Garde optionnelle : si AUTH_REQUIRED=true (env), exige une session.
 * Par défaut (démo) : laisse passer, comme AUTH_ENFORCED=false côté API.
 */
const AUTH_REQUIRED = import.meta.env.VITE_AUTH_REQUIRED === 'true';

export function RequireAuth() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (AUTH_REQUIRED && !isAuthenticated()) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
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
