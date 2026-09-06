import { ensureFreshToken } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';
import type { DocumentLiveEtat, DocumentReunionAvecUrl } from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export function listerDocumentsReunion(reunionId: string) {
  return apiFetch<DocumentReunionAvecUrl[]>(
    `/api/documents${toQueryString({ reunion_id: reunionId })}`,
  );
}

export function obtenirUrlDocument(id: string) {
  return apiFetch<DocumentReunionAvecUrl>(`/api/documents/${id}/url`);
}

export function supprimerDocument(id: string) {
  return apiFetch<{ message: string }>(`/api/documents/${id}`, {
    method: 'DELETE',
  });
}

export function presenterDocument(reunionId: string, documentId: string | null) {
  return apiFetch<DocumentLiveEtat>('/api/documents/presenter', {
    method: 'POST',
    body: JSON.stringify({
      reunion_id: reunionId,
      document_id: documentId,
    }),
  });
}

export function synchroniserDocumentLive(opts: {
  reunionId: string;
  documentId?: string | null;
  page?: number;
  scrollRatio?: number;
}) {
  return apiFetch<DocumentLiveEtat>('/api/documents/live-sync', {
    method: 'POST',
    body: JSON.stringify({
      reunion_id: opts.reunionId,
      document_id: opts.documentId,
      page: opts.page,
      scroll_ratio: opts.scrollRatio,
    }),
  });
}

export function obtenirDocumentLive(reunionId: string) {
  return apiFetch<DocumentLiveEtat>(`/api/documents/live/${reunionId}`);
}

export async function televerserDocument(opts: {
  reunionId: string;
  file: File;
  onProgress?: (pct: number) => void;
}): Promise<DocumentReunionAvecUrl> {
  const token = (await ensureFreshToken()) ?? useAuthStore.getState().accessToken;

  const form = new FormData();
  form.append('reunion_id', opts.reunionId);
  form.append('type_mime', opts.file.type || 'application/octet-stream');
  form.append('fichier', opts.file, opts.file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/documents`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText) as {
          success: boolean;
          data: DocumentReunionAvecUrl;
          error?: { message: string };
        };
        if (xhr.status >= 200 && xhr.status < 300 && payload.success) {
          resolve(payload.data);
        } else {
          reject(new Error(payload.error?.message ?? `Erreur HTTP ${xhr.status}`));
        }
      } catch {
        reject(new Error(`Erreur HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Échec réseau lors de l’upload.'));
    xhr.send(form);
  });
}
