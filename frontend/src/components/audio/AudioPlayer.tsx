import { cn } from '@/lib/cn';
import { Download, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  titre?: string;
  className?: string;
  variant?: 'light' | 'dark';
  allowDownload?: boolean;
  downloadName?: string;
  /** Durée connue (ex. chrono d’enregistrement) si le WebM n’expose pas metadata */
  durationHint?: number;
};

const VITESSES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTemps(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function dureeValide(d: number): boolean {
  return Number.isFinite(d) && d > 0;
}

export function AudioPlayer({
  src,
  titre,
  className,
  variant = 'light',
  allowDownload = true,
  downloadName = 'enregistrement.webm',
  durationHint,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);
  const [vitesse, setVitesse] = useState(1);

  const dark = variant === 'dark';

  const dureeEffective =
    dureeValide(duration) ? duration : dureeValide(durationHint ?? 0) ? durationHint! : 0;

  const resoudreDuree = useCallback(
    (el: HTMLAudioElement) => {
      if (dureeValide(el.duration)) {
        setDuration(el.duration);
        return;
      }
      if (dureeValide(durationHint ?? 0)) {
        setDuration(durationHint!);
        return;
      }
      // WebM MediaRecorder : durée souvent Infinity → forcer le calcul via seek
      const onSeeked = () => {
        el.removeEventListener('seeked', onSeeked);
        if (dureeValide(el.duration)) {
          setDuration(el.duration);
        }
        el.currentTime = 0;
      };
      el.addEventListener('seeked', onSeeked);
      try {
        el.currentTime = 1e10;
      } catch {
        el.removeEventListener('seeked', onSeeked);
      }
    },
    [durationHint],
  );

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
    setCurrent(0);
    setDuration(durationHint ?? 0);
  }, [src, durationHint]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = vitesse;
  }, [vitesse, src]);

  function syncFromElement() {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
    if (dureeValide(el.duration)) setDuration(el.duration);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    if (!el || dureeEffective <= 0) return;
    const v = Number(e.target.value);
    el.currentTime = v;
    setCurrent(v);
  }

  async function handleDownload() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank', 'noopener');
    }
  }

  const pct =
    dureeEffective > 0 ? Math.min(100, (current / dureeEffective) * 100) : 0;

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        dark ? 'border-white/15 bg-white/5 text-white' : 'border-border bg-surface text-text',
        className,
      )}
    >
      {titre && (
        <p
          className={cn(
            'mb-2 truncate text-xs font-medium',
            dark ? 'text-white/70' : 'text-text-muted',
          )}
        >
          {titre}
        </p>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(e) => resoudreDuree(e.currentTarget)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (dureeValide(d)) setDuration(d);
        }}
        onCanPlayThrough={(e) => resoudreDuree(e.currentTarget)}
        onTimeUpdate={syncFromElement}
        onEnded={() => {
          setPlaying(false);
          setCurrent(dureeEffective);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="sr-only"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition',
            dark
              ? 'bg-ogefrem-yellow text-ogefrem-navy hover:bg-ogefrem-yellow/90'
              : 'bg-ogefrem-navy text-white hover:bg-ogefrem-navy/90',
          )}
          aria-label={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <span
          className={cn(
            'min-w-[5.5rem] text-xs tabular-nums',
            dark ? 'text-white/80' : 'text-text-muted',
          )}
        >
          {formatTemps(current)} / {formatTemps(dureeEffective)}
        </span>

        <input
          type="range"
          min={0}
          max={dureeEffective || 1}
          step={0.05}
          value={Math.min(current, dureeEffective || 0)}
          onChange={handleSeek}
          disabled={dureeEffective <= 0}
          className="min-w-[6rem] flex-1 accent-ogefrem-yellow"
          aria-label="Position dans l’audio"
          aria-valuetext={`${Math.round(pct)} pour cent`}
        />

        <select
          value={vitesse}
          onChange={(e) => setVitesse(Number(e.target.value))}
          className={cn(
            'h-9 rounded-lg border px-2 text-xs',
            dark ? 'border-white/20 bg-ogefrem-navy text-white' : 'border-border bg-surface',
          )}
          aria-label="Vitesse de lecture"
        >
          {VITESSES.map((v) => (
            <option key={v} value={v}>
              {v}x
            </option>
          ))}
        </select>

        {allowDownload && (
          <button
            type="button"
            onClick={() => void handleDownload()}
            className={cn(
              'inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs',
              dark
                ? 'border-white/20 text-white/80 hover:bg-white/10'
                : 'border-border text-text-muted hover:bg-surface-muted',
            )}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Télécharger
          </button>
        )}
      </div>
    </div>
  );
}
