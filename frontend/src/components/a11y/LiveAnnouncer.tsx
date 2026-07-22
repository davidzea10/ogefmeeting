import { create } from 'zustand';

type AnnouncerState = {
  message: string;
  politeness: 'polite' | 'assertive';
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
  clear: () => void;
};

export const useAnnouncerStore = create<AnnouncerState>((set) => ({
  message: '',
  politeness: 'polite',
  announce: (message, politeness = 'polite') => set({ message, politeness }),
  clear: () => set({ message: '' }),
}));

/** Région live pour lecteurs d'écran */
export function LiveAnnouncer() {
  const message = useAnnouncerStore((s) => s.message);
  const politeness = useAnnouncerStore((s) => s.politeness);

  return (
    <div
      className="sr-only"
      role="status"
      aria-live={politeness}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
