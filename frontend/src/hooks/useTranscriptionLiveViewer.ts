import { ensureFreshToken } from '@/lib/auth-api';
import { obtenirTranscriptionLive } from '@/lib/transcriptions-api';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect, useRef, useState } from 'react';

type ViewerMessage =
  | { type: 'snapshot'; texte_complet: string; interim: string }
  | { type: 'update'; texte_complet: string; interim: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

/** Polling HTTP si WebSocket indisponible (ms). */
const POLL_WS_DOWN_MS = 4000;
/** Secours rare quand WebSocket connecté (ms). */
const POLL_WS_UP_MS = 20_000;

function buildViewWsUrl(reunionId: string, token: string | null): string {
  const httpBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000';
  const wsBase = httpBase.replace(/^http/i, 'ws').replace(/\/$/, '');
  const params = new URLSearchParams({ reunionId });
  if (token) params.set('token', token);
  return `${wsBase}/ws/transcription-view?${params.toString()}`;
}

/**
 * Réception temps réel de la transcription STT (invités / lecture seule).
 * WebSocket principal + polling HTTP de secours allégé.
 */
export function useTranscriptionLiveViewer(reunionId: string, actif: boolean) {
  const [texteComplet, setTexteComplet] = useState('');
  const [interim, setInterim] = useState('');
  const [connecte, setConnecte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const wsConnecteRef = useRef(false);

  useEffect(() => {
    if (!actif || !reunionId) {
      setConnecte(false);
      return;
    }

    let annule = false;
    let ws: WebSocket | null = null;
    let pingRef: number | null = null;
    let reconnectRef: number | null = null;

    const appliquer = (texte: string, interimText: string) => {
      if (annule) return;
      setTexteComplet(texte);
      setInterim(interimText);
    };

    const poll = async () => {
      try {
        const data = await obtenirTranscriptionLive(reunionId);
        if (!annule && (data.texte_complet || data.interim)) {
          appliquer(data.texte_complet, data.interim);
        }
      } catch {
        /* ignore */
      }
    };

    const planifierPoll = () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
      }
      const interval = wsConnecteRef.current ? POLL_WS_UP_MS : POLL_WS_DOWN_MS;
      pollRef.current = window.setInterval(() => void poll(), interval);
    };

    const connecter = async () => {
      if (annule) return;
      try {
        const token =
          (await ensureFreshToken()) ?? useAuthStore.getState().accessToken ?? null;
        ws = new WebSocket(buildViewWsUrl(reunionId, token));

        ws.onopen = () => {
          if (annule) return;
          wsConnecteRef.current = true;
          setConnecte(true);
          setErreur(null);
          planifierPoll();
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as ViewerMessage;
            if (msg.type === 'snapshot' || msg.type === 'update') {
              appliquer(msg.texte_complet ?? '', msg.interim ?? '');
            }
            if (msg.type === 'error') {
              setErreur(msg.message);
            }
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          wsConnecteRef.current = false;
          setConnecte(false);
          planifierPoll();
          if (!annule) {
            reconnectRef = window.setTimeout(() => void connecter(), 5000);
          }
        };

        ws.onerror = () => {
          wsConnecteRef.current = false;
          setConnecte(false);
          planifierPoll();
        };

        pingRef = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25_000);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Connexion transcription impossible');
      }
    };

    void connecter();
    void poll();
    planifierPoll();

    return () => {
      annule = true;
      wsConnecteRef.current = false;
      if (pingRef != null) window.clearInterval(pingRef);
      if (pollRef.current != null) window.clearInterval(pollRef.current);
      if (reconnectRef != null) window.clearTimeout(reconnectRef);
      pollRef.current = null;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      setConnecte(false);
    };
  }, [actif, reunionId]);

  return { texteComplet, interim, connecte, erreur };
}
