import { GuestOnly, RequireAdmin, RequireAuth, RequireGestionDirection } from '@/components/auth/AuthGuards';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HomePage } from '@/pages/HomePage';
import { InvitationPage } from '@/pages/InvitationPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AdministrationPage } from '@/pages/admin/AdministrationPage';
import { TesteLivePage } from '@/pages/admin/TesteLivePage';
import { ActionsListPage } from '@/pages/actions/ActionsListPage';
import { ArchivesPage } from '@/pages/archives/ArchivesPage';
import { RecherchePage } from '@/pages/recherche/RecherchePage';
import { CompteRenduEditorPage } from '@/pages/comptes-rendus/CompteRenduEditorPage';
import { ComptesRendusListPage } from '@/pages/comptes-rendus/ComptesRendusListPage';
import { ReunionCreatePage } from '@/pages/reunions/ReunionCreatePage';
import { ReunionDetailPage } from '@/pages/reunions/ReunionDetailPage';
import { ReunionEditPage } from '@/pages/reunions/ReunionEditPage';
import { ReunionInvitationPage } from '@/pages/reunions/ReunionInvitationPage';
import { ReunionLivePage } from '@/pages/reunions/ReunionLivePage';
import { ReunionsListPage } from '@/pages/reunions/ReunionsListPage';
import { GestionDirectionPage } from '@/pages/direction/GestionDirectionPage';
import { ProfilPage } from '@/pages/profil/ProfilPage';
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
          { path: 'reunions/:id/invitation', element: <ReunionInvitationPage /> },
          { path: 'reunions/:id', element: <ReunionDetailPage /> },
          { path: 'comptes-rendus/:id', element: <CompteRenduEditorPage /> },
          { path: 'comptes-rendus', element: <ComptesRendusListPage /> },
          { path: 'actions', element: <ActionsListPage /> },
          { path: 'recherche', element: <RecherchePage /> },
          { path: 'archives', element: <ArchivesPage /> },
          { path: 'profil', element: <ProfilPage /> },
          {
            element: <RequireGestionDirection />,
            children: [
              { path: 'gestion-direction', element: <GestionDirectionPage /> },
            ],
          },
          {
            element: <RequireAdmin />,
            children: [
              { path: 'teste-live', element: <TesteLivePage /> },
              { path: 'administration', element: <AdministrationPage /> },
              {
                path: 'utilisateurs',
                element: <Navigate to="/administration?tab=utilisateurs" replace />,
              },
            ],
          },
        ],
      },
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
