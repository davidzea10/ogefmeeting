import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { LiveAnnouncer } from '@/components/a11y/LiveAnnouncer';
import { bootstrapTheme } from '@/stores/ui.store';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';

bootstrapTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <LiveAnnouncer />
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
