import { apiFetch } from '@/lib/api-client';
import type { Transcription } from '@ogefmeeting/shared';

export function obtenirTranscriptionLive(reunionId: string) {
  return apiFetch<{ texte_complet: string; interim: string }>(
    `/api/transcriptions/live/${reunionId}`,
  );
}

export function synchroniserTranscriptionLive(payload: {
  reunion_id: string;
  texte_complet: string;
  texte_interim?: string | null;
}) {
  return apiFetch<{ ok: boolean }>('/api/transcriptions/live-sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function obtenirStatutStt() {
  return apiFetch<{ disponible: boolean; message: string | null }>(
    '/api/transcriptions/stt-status',
  );
}

export function sauvegarderTranscription(payload: {
  reunion_id: string;
  langue: string;
  texte_complet: string;
  enregistrement_id?: string | null;
}) {
  return apiFetch<Transcription>('/api/transcriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listerTranscriptionsReunion(reunionId: string) {
  return apiFetch<Transcription[]>(`/api/transcriptions/reunion/${reunionId}`);
}
