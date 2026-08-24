import { env } from '../config/env.js';

const SAMPLE_RATE = 16000;

export type DeepgramLangue = 'fr' | 'en';

export function isDeepgramConfigured(): boolean {
  return Boolean(env.DEEPGRAM_API_KEY);
}

export function normaliserLangueDeepgram(raw: string | null | undefined): DeepgramLangue {
  if (!raw) return (env.DEEPGRAM_LANGUAGE === 'en' ? 'en' : 'fr') as DeepgramLangue;
  const v = raw.toLowerCase();
  if (v === 'en' || v.startsWith('en-')) return 'en';
  return 'fr';
}

/** URL WebSocket Deepgram Listen (streaming). */
export function buildDeepgramListenUrl(langue?: string | null): string {
  const lang = normaliserLangueDeepgram(langue);
  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL,
    language: lang,
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
    channels: '1',
    interim_results: 'true',
    punctuate: 'true',
    smart_format: 'true',
    endpointing: '300',
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

export function deepgramAuthHeader(): Record<string, string> {
  if (!env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY non configurée');
  }
  return { Authorization: `Token ${env.DEEPGRAM_API_KEY}` };
}

export { SAMPLE_RATE as DEEPGRAM_SAMPLE_RATE };
