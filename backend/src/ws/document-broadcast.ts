import type { WebSocket } from 'ws';
import type { DocumentLiveEtat } from '@ogefmeeting/shared';
import { logger } from '../lib/logger.js';

type SessionDocument = {
  etat: DocumentLiveEtat;
  viewers: Set<WebSocket>;
};

const sessions = new Map<string, SessionDocument>();

function getOrCreate(reunionId: string): SessionDocument {
  let session = sessions.get(reunionId);
  if (!session) {
    session = {
      etat: { document_id: null, page: 1, scroll_ratio: 0 },
      viewers: new Set(),
    };
    sessions.set(reunionId, session);
  }
  return session;
}

function envoyerJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function diffuser(reunionId: string, session: SessionDocument) {
  const payload = { type: 'update' as const, ...session.etat };
  for (const viewer of session.viewers) {
    try {
      envoyerJson(viewer, payload);
    } catch {
      session.viewers.delete(viewer);
    }
  }
  logger.debug(
    {
      reunionId,
      viewers: session.viewers.size,
      documentId: session.etat.document_id,
      page: session.etat.page,
    },
    'Document live diffusé',
  );
}

export function publierDocumentLive(
  reunionId: string,
  etat: DocumentLiveEtat,
): void {
  const session = getOrCreate(reunionId);
  session.etat = {
    document_id: etat.document_id,
    page: etat.page ?? 1,
    scroll_ratio: etat.scroll_ratio ?? 0,
    nom_fichier: etat.nom_fichier ?? null,
    type_mime: etat.type_mime ?? null,
    url_lecture: etat.url_lecture ?? null,
    presentable: etat.presentable ?? Boolean(etat.document_id),
  };
  diffuser(reunionId, session);
}

export function obtenirEtatDocumentLive(reunionId: string): DocumentLiveEtat {
  return getOrCreate(reunionId).etat;
}

export function enregistrerViewerDocument(
  reunionId: string,
  ws: WebSocket,
): DocumentLiveEtat {
  const session = getOrCreate(reunionId);
  session.viewers.add(ws);
  envoyerJson(ws, { type: 'update', ...session.etat });
  return session.etat;
}

export function retirerViewerDocument(reunionId: string, ws: WebSocket): void {
  const session = sessions.get(reunionId);
  if (!session) return;
  session.viewers.delete(ws);
  if (session.viewers.size === 0 && !session.etat.document_id) {
    sessions.delete(reunionId);
  }
}

export function effacerDocumentLiveBroadcast(reunionId: string): void {
  const session = sessions.get(reunionId);
  if (!session) return;
  session.etat = { document_id: null, page: 1, scroll_ratio: 0 };
  diffuser(reunionId, session);
  sessions.delete(reunionId);
}
