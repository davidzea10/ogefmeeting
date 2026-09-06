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

function presqueEgal(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.002;
}

/**
 * Suit la présentation document.
 * Conserve `url_lecture` tant que le document_id ne change pas
 * (évite de recharger le PDF à chaque sync / poll).
 */
export function useDocumentLiveViewer(reunionId: string, enabled: boolean) {
  const [etat, setEtat] = useState<DocumentLiveEtat>(ETAT_VIDE);
  const [connecte, setConnecte] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<number | null>(null);

  const appliquer = useCallback((next: DocumentLiveEtat) => {
    setEtat((prev) => {
      const page = next.page ?? 1;
      const scroll = next.scroll_ratio ?? 0;
      const sameDoc = prev.document_id === next.document_id;

      if (
        sameDoc &&
        prev.page === page &&
        presqueEgal(prev.scroll_ratio ?? 0, scroll) &&
        (next.url_lecture == null || next.url_lecture === prev.url_lecture)
      ) {
        return prev;
      }

      return {
        document_id: next.document_id,
        page,
        scroll_ratio: scroll,
        nom_fichier: next.nom_fichier ?? (sameDoc ? prev.nom_fichier : null) ?? null,
        type_mime: next.type_mime ?? (sameDoc ? prev.type_mime : null) ?? null,
        // URL stable : ne pas remplacer tant que c’est le même document
        url_lecture: sameDoc
          ? (prev.url_lecture ?? next.url_lecture ?? null)
          : (next.url_lecture ?? null),
        presentable:
          next.presentable ??
          (sameDoc ? prev.presentable : undefined) ??
          Boolean(next.document_id),
      };
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

    // Secours HTTP uniquement si WS coupé — et fusion sans casser l’URL
    const poll = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      void obtenirDocumentLive(reunionId)
        .then((data) => {
          if (!cancelled) appliquer(data);
        })
        .catch(() => undefined);
    }, 5000);

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
