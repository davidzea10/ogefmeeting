import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export type TabId =
  | 'informations'
  | 'participants'
  | 'ordre-du-jour'
  | 'enregistrement'
  | 'compte-rendu'
  | 'actions';

type Tab = {
  id: TabId;
  label: string;
  count?: number;
};

type Props = {
  tabs: Tab[];
  active: TabId;
  onChange: (id: TabId) => void;
  children: ReactNode;
};

export function ReunionTabs({ tabs, active, onChange, children }: Props) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Sections de la réunion"
        className="flex gap-1 overflow-x-auto border-b border-border pb-px"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                'shrink-0 rounded-t-lg px-3 py-2.5 text-sm font-semibold transition',
                'focus-visible:ring-2 focus-visible:ring-ogefrem-blue',
                selected
                  ? 'border border-b-0 border-border bg-surface text-ogefrem-blue'
                  : 'text-text-muted hover:bg-surface-muted hover:text-text',
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="ml-1.5 rounded-full bg-ogefrem-blue/10 px-1.5 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="rounded-b-xl border border-t-0 border-border bg-surface p-4 shadow-sm sm:p-6"
      >
        {children}
      </div>
    </div>
  );
}
