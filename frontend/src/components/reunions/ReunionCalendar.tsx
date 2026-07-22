import { ReunionStatusBadge } from '@/components/reunions/ReunionStatusBadge';
import { Button } from '@/components/ui/Button';
import { formatDateCourte } from '@/lib/labels';
import { cn } from '@/lib/cn';
import type { Reunion } from '@ogefmeeting/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';

type Props = {
  reunions: Reunion[];
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function ReunionCalendar({ reunions }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const totalDays = daysInMonth(cursor);
    // Lundi = 0
    const startWeekday = (first.getDay() + 6) % 7;
    const blanks = Array.from({ length: startWeekday }, () => null);
    const days = Array.from({ length: totalDays }, (_, i) => {
      return new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
    });
    return [...blanks, ...days];
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Reunion[]>();
    for (const reunion of reunions) {
      const d = new Date(reunion.date_prevue);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(reunion);
      map.set(key, list);
    }
    return map;
  }, [reunions]);

  const moisLabel = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(cursor);

  const today = new Date();

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mois précédent"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <h3 className="text-lg font-semibold capitalize text-text">{moisLabel}</h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mois suivant"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted">
        {JOURS.map((j) => (
          <div key={j} className="py-2">
            {j}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="min-h-24 rounded-lg bg-surface-muted/40" />;
          }

          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const items = byDay.get(key) ?? [];
          const isToday = sameDay(day, today);

          return (
            <div
              key={key}
              className={cn(
                'min-h-24 rounded-lg border border-border p-1.5 text-left',
                isToday && 'border-ogefrem-blue bg-ogefrem-blue/5',
              )}
            >
              <p
                className={cn(
                  'mb-1 text-xs font-semibold',
                  isToday ? 'text-ogefrem-blue' : 'text-text-muted',
                )}
              >
                {day.getDate()}
              </p>
              <ul className="space-y-1">
                {items.slice(0, 3).map((reunion) => (
                  <li key={reunion.id}>
                    <Link
                      to={`/reunions/${reunion.id}`}
                      className="block truncate rounded bg-ogefrem-yellow/30 px-1 py-0.5 text-[10px] font-medium text-ogefrem-navy hover:bg-ogefrem-yellow/50"
                      title={`${reunion.titre} · ${formatDateCourte(reunion.date_prevue)}`}
                    >
                      {reunion.titre}
                    </Link>
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="text-[10px] text-text-muted">+{items.length - 3}</li>
                )}
              </ul>
              {items[0] && (
                <div className="mt-1 hidden sm:block">
                  <ReunionStatusBadge statut={items[0].statut} className="scale-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
