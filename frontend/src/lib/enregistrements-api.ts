import { ensureFreshToken } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';
import type { EnregistrementAvecUrl } from '@ogefmeeting/shared';
import { apiFetch, toQueryString } from '@/lib/api-client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function extensionPourMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

export function listerEnregistrementsReunion(reunionId: string) {
  return apiFetch<EnregistrementAvecUrl[]>(
    `/api/enregistrements${toQueryString({ reunion_id: reunionId })}`,
  );
}

export function obtenirUrlEnregistrement(id: string) {
  return apiFetch<EnregistrementAvecUrl>(`/api/enregistrements/${id}/url`);
}

export function supprimerEnregistrement(id: string) {
  return apiFetch<{ message: string }>(`/api/enregistrements/${id}`, {
    method: 'DELETE',
  });
}

export async function televerserEnregistrement(opts: {
  reunionId: string;
  audioBlob: Blob;
  mimeType?: string;
  dureeSecondes?: number;
  onProgress?: (pct: number) => void;
}): Promise<EnregistrementAvecUrl> {
  const token = (await ensureFreshToken()) ?? useAuthStore.getState().accessToken;

  const mime = opts.mimeType || opts.audioBlob.type || 'audio/webm';
  const ext = extensionPourMime(mime);

  const form = new FormData();
  form.append('reunion_id', opts.reunionId);
  form.append('type_mime', mime);
  if (opts.dureeSecondes != null) {
    form.append('duree_secondes', String(opts.dureeSecondes));
  }
  form.append('audio', opts.audioBlob, `audio.${ext}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/enregistrements`);
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
          data: EnregistrementAvecUrl;
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

    xhr.onerror = () => reject(new Error('Connexion perdue. Enregistrement sauvegardé localement si disponible.'));
    xhr.ontimeout = () => reject(new Error('Délai d’upload dépassé.'));
    xhr.send(form);
  });
}

/** @deprecated alias MVP */
export const televerserEnregistrementLiveMVP = televerserEnregistrement;

export type { EnregistrementAvecUrl };
