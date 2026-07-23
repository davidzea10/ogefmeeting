import { GuestOnly, RequireAuth } from '@/components/auth/AuthGuards';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HomePage } from '@/pages/HomePage';
import { InvitationPage } from '@/pages/InvitationPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AdministrationPage } from '@/pages/admin/AdministrationPage';
import { ActionsListPage } from '@/pages/actions/ActionsListPage';
import { ArchivesPage } from '@/pages/archives/ArchivesPage';
import { RecherchePage } from '@/pages/recherche/RecherchePage';
import { CompteRenduEditorPage } from '@/pages/comptes-rendus/CompteRenduEditorPage';
import { ComptesRendusListPage } from '@/pages/comptes-rendus/ComptesRendusListPage';
import { ReunionCreatePage } from '@/pages/reunions/ReunionCreatePage';
import { ReunionDetailPage } from '@/pages/reunions/ReunionDetailPage';
import { ReunionEditPage } from '@/pages/reunions/ReunionEditPage';
import { ReunionLivePage } from '@/pages/reunions/ReunionLivePage';
import { ReunionsListPage } from '@/pages/reunions/ReunionsListPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { Navigate, createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'design-system', element: <Navigate to="/notifications" replace /> },
          { path: 'reunions', element: <ReunionsListPage /> },
          { path: 'reunions/nouvelle', element: <ReunionCreatePage /> },
          { path: 'reunions/:id/modifier', element: <ReunionEditPage /> },
          { path: 'reunions/:id', element: <ReunionDetailPage /> },
          { path: 'comptes-rendus/:id', element: <CompteRenduEditorPage /> },
          { path: 'comptes-rendus', element: <ComptesRendusListPage /> },
          { path: 'actions', element: <ActionsListPage /> },
          { path: 'recherche', element: <RecherchePage /> },
          { path: 'archives', element: <ArchivesPage /> },
          { path: 'administration', element: <AdministrationPage /> },
          { path: 'utilisateurs', element: <Navigate to="/administration?tab=utilisateurs" replace /> },
          { path: 'profil', element: <PlaceholderPage title="Mon profil" /> },
        ],
      },
      /** Mode focus hors chrome (sans sidebar / header app) */
      { path: 'reunions/:id/live', element: <ReunionLivePage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: 'connexion', element: <LoginPage /> },
          { path: 'mot-de-passe-oublie', element: <ForgotPasswordPage /> },
        ],
      },
      { path: 'invitation', element: <InvitationPage /> },
      { path: 'reinitialiser-mot-de-passe', element: <ResetPasswordPage /> },
    ],
  },
]);

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-border bg-surface p-10 text-center">
      <h2 className="text-2xl font-semibold text-text">{title}</h2>
      <p className="mt-2 text-text-muted">Module à venir</p>
    </div>
  );
}
