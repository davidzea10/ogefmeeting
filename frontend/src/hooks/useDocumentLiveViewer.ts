import { ensureFreshToken } from '@/lib/auth-api';
import { obtenirDocumentLive } from '@/lib/documents-api';
import { useAuthStore } from '@/stores/auth.store';
import type { DocumentLiveEtat } from '@ogefmeeting/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

function buildWsUrl(reunionId: string, token: string | null): string {
  const httpBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000';
  const wsBase = httpBase.replace(/^http/i, 'ws').replace(/\/$/, '');
  const params = new URLSearchParams({ reunionId });
  if (token) params.set('token', token);
  return `${wsBase}/ws/document-view?${params.toString()}`;
}

const ETAT_VIDE: DocumentLiveEtat = {
  document_id: null,
  page: 1,
  scroll_ratio: 0,
};

/**
 * Suit la présentation document (participants + organisateur en secours).
 */
export function useDocumentLiveViewer(reunionId: string, enabled: boolean) {
  const [etat, setEtat] = useState<DocumentLiveEtat>(ETAT_VIDE);
  const [connecte, setConnecte] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<number | null>(null);

  const appliquer = useCallback((next: DocumentLiveEtat) => {
    setEtat({
      document_id: next.document_id,
      page: next.page ?? 1,
      scroll_ratio: next.scroll_ratio ?? 0,
      nom_fichier: next.nom_fichier ?? null,
      type_mime: next.type_mime ?? null,
      url_lecture: next.url_lecture ?? null,
      presentable: next.presentable,
    });
  }, []);

  useEffect(() => {
    if (!enabled || !reunionId) return;

    let cancelled = false;

    async function demarrer() {
      try {
        const initial = await obtenirDocumentLive(reunionId);
        if (!cancelled) appliquer(initial);
      } catch {
        /* ignore */
      }

      const token =
        (await ensureFreshToken()) ?? useAuthStore.getState().accessToken ?? null;
      if (cancelled) return;

      const ws = new WebSocket(buildWsUrl(reunionId, token));
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setConnecte(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as DocumentLiveEtat & {
            type?: string;
          };
          if (msg.type === 'update' || msg.document_id !== undefined) {
            appliquer(msg);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!cancelled) setConnecte(false);
      };

      pingRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25_000);
    }

    void demarrer();

    const poll = window.setInterval(() => {
      void obtenirDocumentLive(reunionId)
        .then((data) => {
          if (!cancelled) appliquer(data);
        })
        .catch(() => undefined);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      if (pingRef.current != null) {
        window.clearInterval(pingRef.current);
        pingRef.current = null;
      }
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [appliquer, enabled, reunionId]);

  return { etat, connecte, setEtatLocal: appliquer };
}
