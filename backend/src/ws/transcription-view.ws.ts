import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import {
  enregistrerViewerTranscription,
  retirerViewerTranscription,
} from './transcription-broadcast.js';

function parseQuery(url: string | undefined): URLSearchParams {
  try {
    return new URL(url ?? '', 'http://localhost').searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

/**
 * WebSocket lecture seule : reçoit la transcription STT en direct (invités / observateurs).
 * Chemin : /ws/transcription-view?reunionId=...&token=...
 */
export function attachTranscriptionViewWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = (() => {
      try {
        return new URL(req.url ?? '', 'http://localhost').pathname;
      } catch {
        return '';
      }
    })();

    if (pathname !== '/ws/transcription-view') {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (client, req: IncomingMessage) => {
    void handleViewer(client, req);
  });

  logger.info({ path: '/ws/transcription-view' }, 'WebSocket transcription viewer prêt');
}

async function handleViewer(client: WebSocket, req: IncomingMessage): Promise<void> {
  const params = parseQuery(req.url);
  const reunionId = params.get('reunionId')?.trim() ?? '';
  const token = params.get('token')?.trim() ?? '';

  if (!reunionId) {
    sendJson(client, { type: 'error', message: 'reunionId manquant' });
    client.close(1008, 'reunionId manquant');
    return;
  }

  if (token) {
    const user = await verifyAccessToken(token);
    if (!user && env.AUTH_ENFORCED) {
      sendJson(client, { type: 'error', message: 'Token invalide' });
      client.close(1008, 'Token invalide');
      return;
    }
  } else if (env.AUTH_ENFORCED) {
    sendJson(client, { type: 'error', message: 'Authentification requise' });
    client.close(1008, 'Auth requise');
    return;
  }

  enregistrerViewerTranscription(reunionId, client);

  client.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'ping') {
        sendJson(client, { type: 'pong' });
      }
    } catch {
      /* ignore */
    }
  });

  client.on('close', () => {
    retirerViewerTranscription(reunionId, client);
  });

  client.on('error', () => {
    retirerViewerTranscription(reunionId, client);
  });
}
