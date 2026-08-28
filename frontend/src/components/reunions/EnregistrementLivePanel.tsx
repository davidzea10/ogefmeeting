import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { Button } from '@/components/ui/Button';
import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { televerserEnregistrement } from '@/lib/enregistrements-api';
import {
  listerUploadsEnAttente,
  sauvegarderUploadEnAttente,
  supprimerUploadEnAttente,
  type PendingAudioUpload,
} from '@/lib/enregistrements-offline';
import { cn } from '@/lib/cn';
import type { EnregistrementAvecUrl } from '@ogefmeeting/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Pause, Play, Square } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Props = {
  reunionId: string;
  peutEnregistrer: boolean;
  /** Réunion en pause : on garde le panneau visible, on bloque seulement un nouveau démarrage. */
  reunionEnPause?: boolean;
};

export type EnregistrementLivePanelHandle = {
  /** Arrête l'enregistrement en cours et attend la fin de l'envoi (clôture). */
  preparerCloture: () => Promise<void>;
  /** Arrête sans uploader (annulation du live). */
  abandonner: () => void;
};

type Etat = 'idle' | 'recording' | 'paused' | 'uploading' | 'ready' | 'error';

function choisirMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
}

function formatChrono(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function messageErreurMicro(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      return 'Micro refusé. Autorisez le micro dans le navigateur et dans Paramètres Windows → Confidentialité → Microphone.';
    }
    if (e.name === 'NotFoundError') {
      return 'Aucun micro détecté. Branchez un micro ou activez-le dans les paramètres Windows.';
    }
  }
  return e instanceof Error ? e.message : 'Impossible d’accéder au micro.';
}

export const EnregistrementLivePanel = forwardRef<EnregistrementLivePanelHandle, Props>(
  function EnregistrementLivePanel({ reunionId, peutEnregistrer, reunionEnPause = false }, ref) {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const pausedMsRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const niveauSamplesRef = useRef<number[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [etat, setEtat] = useState<Etat>('idle');
  const [erreur, setErreur] = useState<string | null>(null);
  const [chronoMs, setChronoMs] = useState(0);
  const [progressUpload, setProgressUpload] = useState(0);
  const [enregistrement, setEnregistrement] = useState<EnregistrementAvecUrl | null>(null);
  const [urlLocale, setUrlLocale] = useState<string | null>(null);
  const [dureeEnregistree, setDureeEnregistree] = useState<number | null>(null);
  const [qualiteLabel, setQualiteLabel] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const clotureUploadRef = useRef<((err?: Error) => void) | null>(null);
  const abandonSansUploadRef = useRef(false);

  const abandonner = useCallback(() => {
    abandonSansUploadRef.current = true;
    clotureUploadRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopMeter();
    stopTracks();
    setEtat('idle');
    setChronoMs(0);
    setErreur(null);
  }, []);

  const preparerCloture = useCallback(async (): Promise<void> => {
    abandonSansUploadRef.current = false;
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        clotureUploadRef.current = null;
        reject(new Error('Délai dépassé lors de l’enregistrement audio.'));
      }, 120_000);

      clotureUploadRef.current = (err?: Error) => {
        window.clearTimeout(timeout);
        clotureUploadRef.current = null;
        if (err) reject(err);
        else resolve();
      };

      if (pauseStartRef.current != null) {
        pausedMsRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      setEtat('uploading');
      try {
        if (rec.state === 'recording' || rec.state === 'paused') {
          try {
            rec.requestData();
          } catch {
            /* ignore */
          }
        }
        rec.stop();
      } catch (e) {
        clotureUploadRef.current?.(e instanceof Error ? e : new Error('Erreur arrêt audio.'));
      }
    });
  }, []);

  useImperativeHandle(ref, () => ({ preparerCloture, abandonner }), [
    preparerCloture,
    abandonner,
  ]);

  const stopMeter = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const elapsedMs = useCallback(() => {
    if (!startedAtRef.current) return 0;
    const pausedExtra =
      pauseStartRef.current != null ? Date.now() - pauseStartRef.current : 0;
    return Date.now() - startedAtRef.current - pausedMsRef.current - pausedExtra;
  }, []);

  const demarrerMeter = (stream: MediaStream) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      void ctx.resume?.();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      niveauSamplesRef.current = [];

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        niveauSamplesRef.current.push(Math.sqrt(sum / data.length));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* meter optionnel */
    }
  };

  const flushPending = useCallback(async () => {
    const pending = await listerUploadsEnAttente();
    setPendingCount(pending.length);
    for (const p of pending) {
      if (p.reunionId !== reunionId) continue;
      try {
        await televerserEnregistrement({
          reunionId: p.reunionId,
          audioBlob: p.blob,
          mimeType: p.mimeType,
          dureeSecondes: p.dureeSecondes,
        });
        await supprimerUploadEnAttente(p.id);
      } catch {
        break;
      }
    }
    const rest = await listerUploadsEnAttente();
    setPendingCount(rest.filter((x) => x.reunionId === reunionId).length);
    await queryClient.invalidateQueries({ queryKey: ['enregistrements', reunionId] });
  }, [reunionId, queryClient]);

  useEffect(() => {
    void flushPending();
    const onOnline = () => void flushPending();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushPending]);

  useEffect(() => {
    if (etat !== 'recording') return;
    const id = window.setInterval(() => setChronoMs(elapsedMs()), 500);
    return () => window.clearInterval(id);
  }, [etat, elapsedMs]);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopMeter();
      stopTracks();
      if (urlLocale) URL.revokeObjectURL(urlLocale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function demarrer() {
    if (!peutEnregistrer || reunionEnPause) return;
    abandonSansUploadRef.current = false;
    setErreur(null);
    setEnregistrement(null);
    setUrlLocale(null);
    setDureeEnregistree(null);
    setQualiteLabel(null);
    setProgressUpload(0);
    pausedMsRef.current = 0;
    pauseStartRef.current = null;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      demarrerMeter(stream);

      const mimePref = choisirMimeType();
      const rec = mimePref
        ? new MediaRecorder(stream, { mimeType: mimePref, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
      recorderRef.current = rec;
      startedAtRef.current = Date.now();

      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        setErreur('Erreur MediaRecorder.');
        setEtat('error');
        stopMeter();
        stopTracks();
      };
      rec.onstop = () => void finaliser(rec.mimeType);

      rec.start(250);
      setEtat('recording');
      setChronoMs(0);
      announce('Enregistrement démarré.');
    } catch (e) {
      setErreur(messageErreurMicro(e));
      setEtat('error');
      stopMeter();
      stopTracks();
    }
  }

  function pause() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    pauseStartRef.current = Date.now();
    setEtat('paused');
  }

  function reprendre() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    if (pauseStartRef.current != null) {
      pausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setEtat('recording');
  }

  function arreter() {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    if (pauseStartRef.current != null) {
      pausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    setEtat('uploading');
    try {
      if (rec.state === 'recording' || rec.state === 'paused') {
        try {
          rec.requestData();
        } catch {
          /* ignore */
        }
      }
      rec.stop();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur arrêt.');
      setEtat('error');
      stopMeter();
      stopTracks();
    }
  }

  async function finaliser(recorderMime: string) {
    stopMeter();
    if (abandonSansUploadRef.current) {
      abandonSansUploadRef.current = false;
      chunksRef.current = [];
      stopTracks();
      setEtat('idle');
      setChronoMs(0);
      return;
    }
    const type =
      recorderMime || chunksRef.current.find((c) => c.type)?.type || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type });
    stopTracks();

    const samples = niveauSamplesRef.current;
    if (samples.length > 0) {
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      setQualiteLabel(avg > 0.08 ? 'Bonne' : avg > 0.03 ? 'Moyenne' : 'Faible');
    }

    if (blob.size < 800) {
      setErreur('Enregistrement trop court ou vide. Vérifiez le micro Windows.');
      setEtat('error');
      clotureUploadRef.current?.(new Error('Enregistrement audio trop court.'));
      return;
    }

    const local = URL.createObjectURL(blob);
    setUrlLocale(local);

    const dureeSecondes = Math.max(1, Math.round(elapsedMs() / 1000));
    setDureeEnregistree(dureeSecondes);

    try {
      setProgressUpload(0);
      const uploaded = await televerserEnregistrement({
        reunionId,
        audioBlob: blob,
        mimeType: type,
        dureeSecondes,
        onProgress: setProgressUpload,
      });
      setEnregistrement(uploaded);
      setEtat('ready');
      announce('Enregistrement enregistré.');
      await queryClient.invalidateQueries({ queryKey: ['enregistrements', reunionId] });
      clotureUploadRef.current?.();
    } catch (e) {
      const pending: PendingAudioUpload = {
        id: crypto.randomUUID(),
        reunionId,
        mimeType: type,
        dureeSecondes,
        blob,
        creeLe: new Date().toISOString(),
      };
      try {
        await sauvegarderUploadEnAttente(pending);
        setPendingCount((c) => c + 1);
        setErreur(
          (e instanceof Error ? e.message : 'Upload échoué.') +
            ' Sauvegardé localement — sera renvoyé à la reconnexion.',
        );
      } catch {
        setErreur(e instanceof Error ? e.message : 'Upload échoué.');
      }
      setEtat('error');
      clotureUploadRef.current?.(e instanceof Error ? e : new Error('Upload audio échoué.'));
    }
  }

  if (!peutEnregistrer) return null;

  const enCours = etat === 'recording' || etat === 'paused';

  return (
    <section aria-labelledby="audio-live-title" className="space-y-3">
      <h2 id="audio-live-title" className="flex items-center gap-2 text-lg font-semibold text-white">
        <span
          className={cn(
            'inline-flex h-2.5 w-2.5 rounded-full',
            enCours ? 'animate-pulse bg-danger' : 'bg-ogefrem-yellow',
          )}
          aria-hidden
        />
        Enregistrement audio
        {enCours && (
          <span className="rounded bg-danger/20 px-2 py-0.5 text-xs font-bold uppercase text-danger">
            REC
          </span>
        )}
      </h2>

      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        {reunionEnPause && (
          <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-ogefrem-yellow">
            Réunion en pause — l’enregistrement reste visible. Reprenez la réunion pour
            démarrer un nouvel enregistrement.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-ogefrem-yellow">
              {formatChrono(enCours || etat === 'uploading' ? chronoMs : 0)}
            </p>
            <p className="text-xs text-white/60">
              {etat === 'idle' && 'Démarrer pour enregistrer.'}
              {etat === 'recording' && 'En cours…'}
              {etat === 'paused' && 'En pause.'}
              {etat === 'uploading' && `Envoi… ${progressUpload}%`}
              {etat === 'ready' && 'Enregistrement prêt.'}
              {etat === 'error' && 'Erreur.'}
            </p>
            {qualiteLabel && (
              <p className="mt-1 text-xs text-white/50">Qualité micro : {qualiteLabel}</p>
            )}
            {pendingCount > 0 && (
              <p className="mt-1 text-xs text-ogefrem-yellow/90">
                {pendingCount} enregistrement(s) en attente d’envoi
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {etat === 'idle' || etat === 'ready' || etat === 'error' ? (
              <Button
                size="sm"
                disabled={reunionEnPause}
                onClick={() => void demarrer()}
              >
                <Play className="h-4 w-4" aria-hidden />
                Démarrer
              </Button>
            ) : null}
            {etat === 'recording' && (
              <>
                <Button size="sm" variant="secondary" onClick={pause}>
                  <Pause className="h-4 w-4" aria-hidden />
                  Pause
                </Button>
                <Button size="sm" variant="secondary" onClick={arreter}>
                  <Square className="h-4 w-4" aria-hidden />
                  Arrêter
                </Button>
              </>
            )}
            {etat === 'paused' && (
              <>
                <Button size="sm" onClick={reprendre}>
                  <Play className="h-4 w-4" aria-hidden />
                  Reprendre
                </Button>
                <Button size="sm" variant="secondary" onClick={arreter}>
                  <Square className="h-4 w-4" aria-hidden />
                  Arrêter
                </Button>
              </>
            )}
          </div>
        </div>

        {etat === 'uploading' && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-ogefrem-yellow transition-[width] duration-200"
              style={{ width: `${progressUpload}%` }}
              role="progressbar"
              aria-valuenow={progressUpload}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}

        {erreur && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {erreur}
          </p>
        )}

        {(urlLocale || enregistrement?.url_lecture) && etat === 'ready' && (
          <div className="mt-4 space-y-3">
            {urlLocale && (
              <AudioPlayer
                src={urlLocale}
                titre="Préécoute"
                variant="dark"
                downloadName={enregistrement?.nom_fichier ?? 'audio.webm'}
                durationHint={dureeEnregistree ?? enregistrement?.duree_secondes ?? undefined}
              />
            )}
            {enregistrement?.url_lecture && (
              <AudioPlayer
                src={enregistrement.url_lecture}
                titre="Serveur"
                variant="dark"
                downloadName={enregistrement.nom_fichier}
                durationHint={enregistrement.duree_secondes ?? dureeEnregistree ?? undefined}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
},
);
