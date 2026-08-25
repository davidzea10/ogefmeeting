import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

type UiState = {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  theme: ThemeMode;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      theme: 'light',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeToDocument(next);
        set({ theme: next });
      },
    }),
    {
      name: 'ogefmeeting-ui',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeToDocument(state.theme);
      },
    },
  ),
);

/** Applique le thème dès le chargement (évite flash clair). */
export function bootstrapTheme() {
  try {
    const raw = localStorage.getItem('ogefmeeting-ui');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: { theme?: ThemeMode } };
    const theme = parsed.state?.theme;
    if (theme === 'dark' || theme === 'light') applyThemeToDocument(theme);
  } catch {
    /* ignore */
  }
}
