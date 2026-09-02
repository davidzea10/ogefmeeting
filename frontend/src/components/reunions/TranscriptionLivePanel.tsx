import { Button } from '@/components/ui/Button';
import { useTranscriptionLiveViewer } from '@/hooks/useTranscriptionLiveViewer';
import { useTranscriptionLive, type LangueTranscription } from '@/hooks/useTranscriptionLive';
import { cn } from '@/lib/cn';
import {
  obtenirStatutStt,
  sauvegarderTranscription,
  synchroniserTranscriptionLive,
} from '@/lib/transcriptions-api';
import { Captions, Eraser, Mic, MicOff, Save } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Props = {
  reunionId: string;
  /** Qui peut démarrer/arrêter le flux STT (généralement secrétaires / admin). */
  peutControle: boolean;
  /** Désactive le démarrage (ex. réunion en pause). */
  desactive?: boolean;
  /** Lecture seule invités — WebSocket temps réel + fallback props. */
  textePartage?: string | null;
  interimPartage?: string | null;
  /** Réunion en cours/en pause → active la réception STT partagée. */
  enLive?: boolean;
};

export type TranscriptionLivePanelHandle = {
  /** Sauvegarde la transcription et arrête le flux (clôture). */
  preparerCloture: () => Promise<void>;
  /** Arrête le flux sans sauvegarder (annulation du live). */
  abandonner: () => void;
};

export const TranscriptionLivePanel = forwardRef<TranscriptionLivePanelHandle, Props>(
  function TranscriptionLivePanel(
    { reunionId, peutControle, desactive, textePartage, interimPartage, enLive = true },
    ref,
  ) {
    const syncTimeoutRef = useRef<number | null>(null);

    const viewer = useTranscriptionLiveViewer(reunionId, enLive);

    const publierTexte = useCallback(
      (texte: string, interimText: string) => {
        if (!peutControle) return;
        if (syncTimeoutRef.current != null) {
          window.clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = window.setTimeout(() => {
          void synchroniserTranscriptionLive({
            reunion_id: reunionId,
            texte_complet: texte,
            texte_interim: interimText || null,
          }).catch(() => {
            /* best-effort — le backend WS diffuse aussi */
          });
        }, 400);
      },
      [peutControle, reunionId],
    );

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
    } = useTranscriptionLive(reunionId, { onTexteChange: publierTexte });

    const [saving, setSaving] = useState(false);
    const [saveErreur, setSaveErreur] = useState<string | null>(null);
    const [sttDisponible, setSttDisponible] = useState<boolean | null>(null);
    const [sttIndispoMessage, setSttIndispoMessage] = useState<string | null>(null);

    useEffect(() => {
      let annule = false;
      void obtenirStatutStt()
        .then((stt) => {
          if (annule) return;
          setSttDisponible(stt.disponible);
          setSttIndispoMessage(stt.disponible ? null : stt.message);
        })
        .catch(() => {
          if (annule) return;
          setSttDisponible(false);
          setSttIndispoMessage(
            'Impossible de contacter le backend pour vérifier la transcription live.',
          );
        });
      return () => {
        annule = true;
      };
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);
    const texteRef = useRef(texteComplet);
    const sauvegardeOkRef = useRef(sauvegardeOk);
    const langueRef = useRef(langue);
    const actifRef = useRef(actif);

    const aDuTexteLocal = segments.length > 0 || Boolean(interim) || Boolean(texteComplet);

    /** Flux micro local (organisateur / secrétaire qui a démarré le STT). */
    const fluxLocalActif = peutControle && actif;
    const textePartageLive = (viewer.texteComplet || textePartage || '').trim();
    const interimPartageLive = (viewer.interim || interimPartage || '').trim();
    const texteAffiche = fluxLocalActif && aDuTexteLocal ? texteComplet.trim() : textePartageLive;
    const interimAffiche = fluxLocalActif && interim ? interim.trim() : interimPartageLive;
    const aDuTexteAffiche = Boolean(texteAffiche || interimAffiche || (fluxLocalActif && segments.length));

    useEffect(() => {
      texteRef.current = texteComplet;
    }, [texteComplet]);
    useEffect(() => {
      sauvegardeOkRef.current = sauvegardeOk;
    }, [sauvegardeOk]);
    useEffect(() => {
      langueRef.current = langue;
    }, [langue]);
    useEffect(() => {
      actifRef.current = actif;
    }, [actif]);

    useEffect(() => {
      return () => {
        if (syncTimeoutRef.current != null) {
          window.clearTimeout(syncTimeoutRef.current);
        }
      };
    }, []);

    /** Pause réunion → arrêt du flux STT. */
    useEffect(() => {
      if (desactive && actif) {
        arreter();
      }
    }, [desactive, actif, arreter]);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    }, [segments, interim, texteAffiche, interimAffiche]);

    const viewerErreur = viewer.erreur;

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
        throw e;
      } finally {
        setSaving(false);
      }
    };

    const preparerCloture = async (): Promise<void> => {
      const texte = texteRef.current.trim();
      if (texte && !sauvegardeOkRef.current) {
        await sauvegarderTranscription({
          reunion_id: reunionId,
          langue: langueRef.current,
          texte_complet: texte,
        });
        setSauvegardeOk(true);
      }
      if (actifRef.current) {
        arreter();
      }
    };

    const abandonner = () => {
      if (actifRef.current) arreter();
      effacer();
      setSauvegardeOk(false);
    };

    useImperativeHandle(ref, () => ({ preparerCloture, abandonner }), [
      arreter,
      effacer,
      reunionId,
    ]);

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
            {peutControle && (
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
            )}
          </div>
          {(fluxLocalActif || (enLive && (aDuTexteAffiche || viewer.connecte))) && (
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
          {sttDisponible === false && sttIndispoMessage && peutControle ? (
            <p
              className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-amber-100"
              role="status"
            >
              {sttIndispoMessage}
            </p>
          ) : null}

          {peutControle && !aDuTexteLocal && !texteAffiche && !erreur && sttDisponible !== false && (
            <p className="text-sm leading-relaxed text-white/45">
              Choisissez la langue, puis démarrez la transcription.
            </p>
          )}

          {enLive && !fluxLocalActif && !aDuTexteAffiche && !erreur && !viewerErreur && (
            <p className="text-sm leading-relaxed text-white/45">
              {viewer.connecte
                ? 'En attente de la transcription de l’organisateur…'
                : 'Connexion à la transcription live…'}
            </p>
          )}

          {viewerErreur && !fluxLocalActif ? (
            <p className="text-xs text-white/45" role="status">
              Sync secours actif ({viewerErreur})
            </p>
          ) : null}

          {fluxLocalActif &&
            segments.map((seg) => (
              <p key={seg.id} className="text-sm leading-relaxed text-white/90">
                {seg.text}
              </p>
            ))}

          {fluxLocalActif && interim ? (
            <p className="text-sm italic leading-relaxed text-white/45">{interim}</p>
          ) : null}

          {!fluxLocalActif && texteAffiche ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{texteAffiche}</p>
          ) : null}

          {!fluxLocalActif && interimAffiche ? (
            <p className="text-sm italic leading-relaxed text-white/45">{interimAffiche}</p>
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
                disabled={desactive || connecting || sttDisponible === false}
                loading={connecting || sttDisponible === null}
                onClick={() => void demarrer()}
              >
                <Mic className="h-4 w-4" aria-hidden />
                Démarrer STT
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={arreter}>
                <MicOff className="h-4 w-4" aria-hidden />
                Arrêter STT
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={!texteComplet || saving || sauvegardeOk}
              loading={saving}
              onClick={() => void sauvegarder()}
            >
              <Save className="h-4 w-4" aria-hidden />
              Sauvegarder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!texteComplet || actif}
              onClick={effacer}
              aria-label="Effacer la transcription affichée"
            >
              <Eraser className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </aside>
    );
  },
);
