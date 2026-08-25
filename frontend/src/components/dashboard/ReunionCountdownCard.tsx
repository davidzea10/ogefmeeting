import { Button } from '@/components/ui/Button';
import { formatDateHeure } from '@/lib/labels';
import type { Reunion } from '@ogefmeeting/shared';
import { CalendarClock, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

function splitCountdown(targetMs: number, nowMs: number): Parts {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type Props = {
  reunion: Reunion;
};

/** Grand compte à rebours vers la prochaine réunion où l’utilisateur est invité. */
export function ReunionCountdownCard({ reunion }: Props) {
  const targetMs = useMemo(
    () => new Date(reunion.date_prevue).getTime(),
    [reunion.date_prevue],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = splitCountdown(targetMs, now);
  const started = parts.totalMs === 0;

  return (
    <section
      aria-label="Compte à rebours de la prochaine réunion"
      className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-md"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse at top right, color-mix(in srgb, var(--color-ogefrem-blue) 22%, transparent), transparent 55%), radial-gradient(ellipse at bottom left, color-mix(in srgb, var(--color-ogefrem-yellow) 18%, transparent), transparent 50%)',
        }}
      />
      <div className="relative z-10 space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ogefrem-blue">
              Prochaine réunion
            </p>
            <h3 className="text-xl font-bold leading-snug text-text sm:text-2xl md:text-3xl">
              {reunion.titre}
            </h3>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                {formatDateHeure(reunion.date_prevue)}
              </span>
              {reunion.lieu ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {reunion.lieu}
                </span>
              ) : null}
            </p>
          </div>
          <Link to={`/reunions/${reunion.id}`}>
            <Button size="sm" variant="secondary">
              Voir la réunion
            </Button>
          </Link>
        </div>

        {started ? (
          <p className="rounded-xl bg-ogefrem-blue/10 px-4 py-3 text-center text-base font-semibold text-ogefrem-blue sm:text-lg">
            La réunion a commencé — rejoignez-la maintenant.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <TimeBlock label="Jours" value={parts.days} />
            <TimeBlock label="Heures" value={pad(parts.hours)} />
            <TimeBlock label="Minutes" value={pad(parts.minutes)} />
            <TimeBlock label="Secondes" value={pad(parts.seconds)} />
          </div>
        )}
      </div>
    </section>
  );
}

function TimeBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-4 text-center shadow-sm backdrop-blur-sm">
      <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-text sm:text-4xl md:text-5xl">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:text-xs">
        {label}
      </p>
    </div>
  );
}
