import { useEffect, useRef, useState } from 'react';

/**
 * Chronomètre depuis une date de début ISO.
 * Affiche HH:MM:SS (ou MM:SS si < 1h).
 * Si `enPause`, le compteur est figé.
 */
export function useChronometre(
  dateDebutIso: string | null | undefined,
  enPause = false,
) {
  const [now, setNow] = useState(() => Date.now());
  const frozenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (enPause) {
      frozenAtRef.current = Date.now();
      return;
    }
    frozenAtRef.current = null;
    if (!dateDebutIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [dateDebutIso, enPause]);

  if (!dateDebutIso) {
    return { elapsedMs: 0, label: '00:00', running: false };
  }

  const start = new Date(dateDebutIso).getTime();
  const end = enPause && frozenAtRef.current != null ? frozenAtRef.current : now;
  const elapsedMs = Math.max(0, end - start);
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return { elapsedMs, label, running: !enPause };
}
