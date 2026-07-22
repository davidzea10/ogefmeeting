import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

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
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** Clé anon — login/signup utilisateur (jamais service_role côté auth password) */
  SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /**
   * Si false (défaut) : JWT reconnu s'il est présent, mais jamais bloquant.
   * Si true : requireAuth / requireRoles refusent les requêtes non authentifiées.
   * → Déploiement et usage libres tant que AUTH_ENFORCED=false.
   */
  AUTH_ENFORCED: booleanFromEnv.default(false),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
