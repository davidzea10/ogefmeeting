import { apiFetch } from '@/lib/api-client';
import type { Transcription } from '@ogefmeeting/shared';

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
