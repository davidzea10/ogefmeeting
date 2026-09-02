import type { WebSocket } from 'ws';
import { logger } from '../lib/logger.js';

export type TranscriptionLiveEtat = {
  texteComplet: string;
  interim: string;
  viewers: Set<WebSocket>;
  dbSyncTimeout: ReturnType<typeof setTimeout> | null;
  dbSyncPending: { texte: string; interim: string } | null;
};

const sessions = new Map<string, TranscriptionLiveEtat>();

function getOrCreate(reunionId: string): TranscriptionLiveEtat {
  let session = sessions.get(reunionId);
  if (!session) {
    session = {
      texteComplet: '',
      interim: '',
      viewers: new Set(),
      dbSyncTimeout: null,
      dbSyncPending: null,
    };
    sessions.set(reunionId, session);
  }
  return session;
}

function messageEtat(session: TranscriptionLiveEtat) {
  return {
    type: 'update' as const,
    texte_complet: session.texteComplet,
    interim: session.interim,
  };
}

function envoyerJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function diffuser(reunionId: string, session: TranscriptionLiveEtat) {
  const payload = messageEtat(session);
  for (const viewer of session.viewers) {
    try {
      envoyerJson(viewer, payload);
    } catch {
      session.viewers.delete(viewer);
    }
  }
  logger.debug(
    { reunionId, viewers: session.viewers.size, len: session.texteComplet.length },
    'Transcription live diffusée',
  );
}

/** Planifie une persistance DB (best-effort, debounce 1 s). */
function planifierSyncDb(reunionId: string, session: TranscriptionLiveEtat) {
  session.dbSyncPending = {
    texte: session.texteComplet,
    interim: session.interim,
  };
  if (session.dbSyncTimeout) return;

  session.dbSyncTimeout = setTimeout(() => {
    session.dbSyncTimeout = null;
    const pending = session.dbSyncPending;
    session.dbSyncPending = null;
    if (!pending) return;

    void import('../services/reunion.service.js')
      .then(({ reunionService }) =>
        reunionService.synchroniserTranscriptionLive(
          reunionId,
          pending.texte,
          pending.interim || null,
        ),
      )
      .catch((err) => {
        logger.debug({ err, reunionId }, 'Sync DB transcription live ignorée');
      });
  }, 1000);
}

/** Met à jour l'état partagé et notifie tous les viewers connectés. */
export function publierTranscriptionLive(
  reunionId: string,
  texteComplet: string,
  interim: string,
): void {
  const session = getOrCreate(reunionId);
  session.texteComplet = texteComplet;
  session.interim = interim;
  diffuser(reunionId, session);
  planifierSyncDb(reunionId, session);
}

/** Ajoute un chunk STT (final ou interim). */
export function ajouterChunkTranscriptionLive(
  reunionId: string,
  text: string,
  isFinal: boolean,
): TranscriptionLiveEtat {
  const session = getOrCreate(reunionId);
  if (isFinal) {
    session.texteComplet = [session.texteComplet, text].filter(Boolean).join(' ').trim();
    session.interim = '';
  } else {
    session.interim = text;
  }
  diffuser(reunionId, session);
  planifierSyncDb(reunionId, session);
  return session;
}

export function obtenirEtatTranscriptionLive(reunionId: string): {
  texte_complet: string;
  interim: string;
} {
  const session = sessions.get(reunionId);
  return {
    texte_complet: session?.texteComplet ?? '',
    interim: session?.interim ?? '',
  };
}

export function enregistrerViewerTranscription(reunionId: string, ws: WebSocket): void {
  const session = getOrCreate(reunionId);
  session.viewers.add(ws);
  envoyerJson(ws, {
    type: 'snapshot',
    texte_complet: session.texteComplet,
    interim: session.interim,
  });
}

export function retirerViewerTranscription(reunionId: string, ws: WebSocket): void {
  const session = sessions.get(reunionId);
  if (!session) return;
  session.viewers.delete(ws);
  if (session.viewers.size === 0 && !session.texteComplet && !session.interim) {
    if (session.dbSyncTimeout) clearTimeout(session.dbSyncTimeout);
    sessions.delete(reunionId);
  }
}

export function effacerTranscriptionLiveBroadcast(reunionId: string): void {
  const session = sessions.get(reunionId);
  if (!session) return;

  const endedPayload = { type: 'ended' as const };
  for (const viewer of session.viewers) {
    try {
      envoyerJson(viewer, endedPayload);
      viewer.close(1000, 'reunion ended');
    } catch {
      session.viewers.delete(viewer);
    }
  }

  session.texteComplet = '';
  session.interim = '';
  if (session.dbSyncTimeout) {
    clearTimeout(session.dbSyncTimeout);
    session.dbSyncTimeout = null;
  }
  session.dbSyncPending = null;
  sessions.delete(reunionId);
}
