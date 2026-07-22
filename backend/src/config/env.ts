import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

function normaliserOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** URL projet Supabase (sans /rest/v1 ni slash final). */
function normaliserSupabaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/$/, '');
}

/** Une ou plusieurs origines séparées par des virgules. */
const originsFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string' || value.trim() === '') return ['http://localhost:5173'];
  return value
    .split(',')
    .map((part) => normaliserOrigin(part))
    .filter(Boolean);
}, z.array(z.string()).min(1));

const originFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string' || value.trim() === '') return value;
  return normaliserOrigin(value);
}, z.string());

const supabaseUrlFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return normaliserSupabaseUrl(value);
}, z.string().url().optional());

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return false;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  /** Origines autorisées (séparées par des virgules). */
  CORS_ORIGIN: originsFromEnv.default(['http://localhost:5173']),
  FRONTEND_URL: originFromEnv.default('http://localhost:5173'),
  SUPABASE_URL: supabaseUrlFromEnv,
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** Clé anon — login/signup utilisateur (jamais service_role côté auth password) */
  SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /**
   * Si false (défaut) : JWT reconnu s'il est présent, mais jamais bloquant.
   * Si true : requireAuth / requireRoles refusent les requêtes non authentifiées.
   */
  AUTH_ENFORCED: booleanFromEnv.default(false),
});

const parsed = envSchema.parse(process.env);

/** Liste unique : CORS_ORIGIN + FRONTEND_URL */
export const corsOrigins = Array.from(
  new Set([...parsed.CORS_ORIGIN, parsed.FRONTEND_URL].filter(Boolean)),
);

export const env = {
  ...parsed,
  /** Première origine (rétrocompat) */
  CORS_ORIGIN: corsOrigins[0] ?? 'http://localhost:5173',
};

export type Env = typeof env;

/** Autorise l’origine exacte, ou les previews Vercel si une URL *.vercel.app est déjà listée. */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;

  const allowVercelPreviews = corsOrigins.some((o) => o.includes('.vercel.app'));
  if (allowVercelPreviews) {
    try {
      const host = new URL(origin).hostname;
      if (host.endsWith('.vercel.app') && host.includes('ogefmeeting')) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}
