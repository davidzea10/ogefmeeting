import { WebSocket } from 'ws';

/** Ping serveur toutes les 25 s — maintient les WS actives sur Render Starter (réunions longues). */
const PING_INTERVAL_MS = 25_000;

export function demarrerKeepAliveWs(client: WebSocket): () => void {
  const timer = setInterval(() => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.ping();
      } catch {
        /* ignore */
      }
    }
  }, PING_INTERVAL_MS);

  return () => clearInterval(timer);
}
