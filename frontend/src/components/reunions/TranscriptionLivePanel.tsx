import { Button } from '@/components/ui/Button';
import { useTranscriptionLive, type LangueTranscription } from '@/hooks/useTranscriptionLive';
import { cn } from '@/lib/cn';
import { sauvegarderTranscription } from '@/lib/transcriptions-api';
import { Captions, Eraser, Mic, MicOff, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  reunionId: string;
  /** Qui peut démarrer/arrêter le flux STT (généralement secrétaires / admin). */
  peutControle: boolean;
  /** Désactive le démarrage (ex. réunion en pause). */
  desactive?: boolean;
};

export function TranscriptionLivePanel({ reunionId, peutControle, desactive }: Props) {
  const {
    actif,
    connecting,
    erreur,
    interim,
    segments,
    langue,
    setLangue,
    texteComplet,
    sauvegardeOk,
    setSauvegardeOk,
    demarrer,
    arreter,
    effacer,
  } = useTranscriptionLive(reunionId);

  const [saving, setSaving] = useState(false);
  const [saveErreur, setSaveErreur] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [segments, interim]);

  const changerLangue = (l: LangueTranscription) => {
    if (actif) return;
    setLangue(l);
  };

  const sauvegarder = async () => {
    if (!texteComplet) return;
    setSaving(true);
    setSaveErreur(null);
    try {
      await sauvegarderTranscription({
        reunion_id: reunionId,
        langue,
        texte_complet: texteComplet,
      });
      setSauvegardeOk(true);
    } catch (e) {
      setSaveErreur(e instanceof Error ? e.message : 'Échec de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-lg backdrop-blur-sm lg:min-h-0 lg:max-h-[calc(100vh-7.5rem)]"
      aria-labelledby="transcription-live-title"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h2
            id="transcription-live-title"
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ogefrem-yellow"
          >
            <Captions className="h-4 w-4 shrink-0" aria-hidden />
            Transcription
          </h2>
          <div className="mt-2 flex items-center gap-1" role="group" aria-label="Langue de transcription">
            <button
              type="button"
              disabled={actif}
              onClick={() => changerLangue('fr')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                langue === 'fr'
                  ? 'bg-ogefrem-yellow text-ogefrem-navy'
                  : 'bg-white/10 text-white/70 hover:bg-white/15',
                actif && 'opacity-50',
              )}
            >
              Français
            </button>
            <button
              type="button"
              disabled={actif}
              onClick={() => changerLangue('en')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                langue === 'en'
                  ? 'bg-ogefrem-yellow text-ogefrem-navy'
                  : 'bg-white/10 text-white/70 hover:bg-white/15',
                actif && 'opacity-50',
              )}
            >
              English
            </button>
          </div>
        </div>
        {actif && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-danger/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
            Live
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {segments.length === 0 && !interim && !erreur && (
          <p className="text-sm leading-relaxed text-white/45">
            {peutControle
              ? 'Choisissez la langue, puis démarrez la transcription.'
              : 'La transcription apparaîtra ici lorsque le secrétaire la démarrera.'}
          </p>
        )}

        {segments.map((seg) => (
          <p key={seg.id} className="text-sm leading-relaxed text-white/90">
            {seg.text}
          </p>
        ))}

        {interim ? (
          <p className="text-sm italic leading-relaxed text-white/45">{interim}</p>
        ) : null}

        {erreur ? (
          <p className="rounded-lg border border-danger/40 bg-danger/15 px-3 py-2 text-sm text-red-200" role="alert">
            {erreur}
          </p>
        ) : null}
        {saveErreur ? (
          <p className="rounded-lg border border-danger/40 bg-danger/15 px-3 py-2 text-sm text-red-200" role="alert">
            {saveErreur}
          </p>
        ) : null}
        {sauvegardeOk ? (
          <p className="text-xs text-success" role="status">
            Transcription sauvegardée — visible après clôture (admin / organisateur).
          </p>
        ) : null}
      </div>

      {peutControle && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
          {!actif ? (
            <Button
              size="sm"
              className="!bg-ogefrem-yellow !text-ogefrem-navy hover:!bg-ogefrem-yellow/90"
              loading={connecting}
              disabled={desactive}
              onClick={() => void demarrer()}
            >
              <Mic className="h-4 w-4" aria-hidden />
              Démarrer
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="!bg-white/15 !text-white hover:!bg-white/25"
              onClick={arreter}
            >
              <MicOff className="h-4 w-4" aria-hidden />
              Arrêter
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn('!text-white/70 hover:!bg-white/10 hover:!text-white')}
            loading={saving}
            disabled={!texteComplet}
            onClick={() => void sauvegarder()}
          >
            <Save className="h-4 w-4" aria-hidden />
            Sauver texte
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn('!text-white/70 hover:!bg-white/10 hover:!text-white')}
            onClick={effacer}
            disabled={segments.length === 0 && !interim}
          >
            <Eraser className="h-4 w-4" aria-hidden />
            Effacer
          </Button>
        </div>
      )}
    </aside>
  );
}
