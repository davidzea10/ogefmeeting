import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import {
  buildDeepgramListenUrl,
  deepgramAuthHeader,
  isDeepgramConfigured,
  normaliserLangueDeepgram,
} from '../services/deepgram.service.js';
import { env } from '../config/env.js';

type ClientMessage =
  | { type: 'ping' }
  | { type: 'close' };

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
 * Proxy WebSocket navigateur ↔ Deepgram.
 * Chemin : /ws/transcription?reunionId=...&token=...
 * Le client envoie des chunks PCM linear16 16 kHz mono (binary).
 * Le serveur renvoie { type: 'transcript', text, is_final }.
 */
export function attachTranscriptionWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = (() => {
      try {
        return new URL(req.url ?? '', 'http://localhost').pathname;
      } catch {
        return '';
      }
    })();

    if (pathname !== '/ws/transcription') {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (client, req: IncomingMessage) => {
    void handleClient(client, req);
  });

  logger.info({ path: '/ws/transcription' }, 'WebSocket transcription Deepgram prêt');
}

async function handleClient(client: WebSocket, req: IncomingMessage): Promise<void> {
  const params = parseQuery(req.url);
  const reunionId = params.get('reunionId')?.trim() ?? '';
  const token = params.get('token')?.trim() ?? '';
  const langue = normaliserLangueDeepgram(params.get('language'));

  if (!reunionId) {
    sendJson(client, { type: 'error', message: 'reunionId manquant' });
    client.close(1008, 'reunionId manquant');
    return;
  }

  if (!isDeepgramConfigured()) {
    sendJson(client, {
      type: 'error',
      message: 'Deepgram non configuré (DEEPGRAM_API_KEY absente côté backend)',
    });
    client.close(1013, 'Deepgram non configuré');
    return;
  }

  // Auth softe : si token fourni, on le vérifie ; si AUTH_ENFORCED, token obligatoire
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

  let deepgram: WebSocket;
  try {
    deepgram = new WebSocket(buildDeepgramListenUrl(langue), {
      headers: deepgramAuthHeader(),
    });
  } catch (err) {
    logger.error({ err }, 'Échec ouverture WebSocket Deepgram');
    sendJson(client, { type: 'error', message: 'Impossible de joindre Deepgram' });
    client.close(1011, 'Deepgram');
    return;
  }

  let closed = false;
  const closeBoth = (code = 1000, reason = 'bye') => {
    if (closed) return;
    closed = true;
    try {
      if (deepgram.readyState === WebSocket.OPEN) {
        deepgram.send(JSON.stringify({ type: 'CloseStream' }));
        deepgram.close();
      } else {
        deepgram.terminate();
      }
    } catch {
      /* ignore */
    }
    try {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    } catch {
      /* ignore */
    }
  };

  deepgram.on('open', () => {
    sendJson(client, {
      type: 'ready',
      reunionId,
      language: langue,
      model: env.DEEPGRAM_MODEL,
    });
    logger.info({ reunionId, langue }, 'Session transcription live ouverte');
  });

  deepgram.on('message', (data) => {
    try {
      const payload = JSON.parse(data.toString()) as {
        type?: string;
        is_final?: boolean;
        channel?: { alternatives?: Array<{ transcript?: string }> };
      };

      if (payload.type && payload.type !== 'Results') {
        return;
      }

      const text = payload.channel?.alternatives?.[0]?.transcript?.trim() ?? '';
      if (!text) return;

      sendJson(client, {
        type: 'transcript',
        text,
        is_final: Boolean(payload.is_final),
      });
    } catch (err) {
      logger.debug({ err }, 'Message Deepgram non JSON / ignoré');
    }
  });

  deepgram.on('error', (err) => {
    logger.error({ err, reunionId }, 'Erreur WebSocket Deepgram');
    sendJson(client, { type: 'error', message: 'Erreur Deepgram' });
    closeBoth(1011, 'Deepgram error');
  });

  deepgram.on('close', () => {
    sendJson(client, { type: 'closed' });
    closeBoth();
  });

  client.on('message', (data, isBinary) => {
    if (closed) return;

    if (!isBinary) {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        if (msg.type === 'ping') {
          sendJson(client, { type: 'pong' });
          return;
        }
        if (msg.type === 'close') {
          closeBoth();
        }
      } catch {
        /* ignore */
      }
      return;
    }

    if (deepgram.readyState === WebSocket.OPEN) {
      deepgram.send(data);
    }
  });

  client.on('close', () => closeBoth());
  client.on('error', () => closeBoth(1011, 'client error'));
}
