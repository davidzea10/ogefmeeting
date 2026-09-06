import { env } from '../config/env.js';
import {
  KEYWORD_INTENSIFIER_NOVA2,
  LEXIQUE_STT_OGEFREM,
} from './ogefrem-stt-lexique.js';

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

function estModeleNova3(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('nova-3') || m.includes('nova3') || m.startsWith('flux');
}

function estModeleKeywords(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('nova-2') ||
    m.includes('nova-1') ||
    m.includes('enhanced') ||
    m === 'nova' ||
    m.includes('base')
  );
}

/** Termes du lexique OGEFREM + éventuels ajouts .env (DEEPGRAM_KEYTERMS). */
export function termesSttOgefrem(): string[] {
  const extras = (env.DEEPGRAM_KEYTERMS ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...LEXIQUE_STT_OGEFREM, ...extras]) {
    const key = t.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

/**
 * Ajoute le boosting vocabulaire métier à l’URL Listen.
 * - Nova-3 / Flux → `keyterm` (répéter le paramètre)
 * - Nova-2 / Enhanced → `keywords=TERM:intensifier`
 */
function appliquerLexiqueStt(params: URLSearchParams, model: string): void {
  const termes = termesSttOgefrem();
  if (termes.length === 0) return;

  if (estModeleNova3(model)) {
    for (const terme of termes) {
      params.append('keyterm', terme);
    }
    return;
  }

  if (estModeleKeywords(model)) {
    for (const terme of termes) {
      params.append('keywords', `${terme}:${KEYWORD_INTENSIFIER_NOVA2}`);
    }
  }
}

/** URL WebSocket Deepgram Listen (streaming). */
export function buildDeepgramListenUrl(langue?: string | null): string {
  const lang = normaliserLangueDeepgram(langue);
  const model = env.DEEPGRAM_MODEL;
  const params = new URLSearchParams({
    model,
    language: lang,
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
    channels: '1',
    interim_results: 'true',
    punctuate: 'true',
    smart_format: 'true',
    endpointing: '300',
  });
  appliquerLexiqueStt(params, model);
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

export function deepgramAuthHeader(): Record<string, string> {
  if (!env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY non configurée');
  }
  return { Authorization: `Token ${env.DEEPGRAM_API_KEY}` };
}

export { SAMPLE_RATE as DEEPGRAM_SAMPLE_RATE };
