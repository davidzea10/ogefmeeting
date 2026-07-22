import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from './logger.js';

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAuth: SupabaseClient | null = null;

/**
 * Options communes.
 * `realtime.transport = ws` : obligatoire sur Node < 22
 * (sinon : "native WebSocket not found").
 */
function clientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws,
    },
  };
}

/**
 * Indique si les variables Supabase admin sont présentes.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

/**
 * Client Supabase avec clé service_role (backend uniquement).
 * Retourne null si non configuré (utile pour /health).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      env.SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
      clientOptions() as Parameters<typeof createClient>[2],
    );

    logger.info('Client Supabase (service_role) initialisé');
  }

  return supabaseAdmin;
}

/**
 * Client Auth (clé anon) pour login / signup / refresh.
 * Ne bloque pas l'app si absent — les routes auth renverront une erreur claire.
 */
export function getSupabaseAuth(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  if (!supabaseAuth) {
    supabaseAuth = createClient(
      env.SUPABASE_URL!,
      env.SUPABASE_ANON_KEY!,
      clientOptions() as Parameters<typeof createClient>[2],
    );

    logger.info('Client Supabase Auth (anon) initialisé');
  }

  return supabaseAuth;
}

/**
 * Client Supabase obligatoire pour les opérations métier.
 */
export function requireSupabaseAdmin(): SupabaseClient {
  const client = getSupabaseAdmin();

  if (!client) {
    throw new AppError(
      503,
      'Supabase non configuré. Vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return client;
}

export function requireSupabaseAuth(): SupabaseClient {
  const client = getSupabaseAuth();

  if (!client) {
    throw new AppError(
      503,
      'Auth Supabase non configurée. Vérifiez SUPABASE_URL et SUPABASE_ANON_KEY.',
    );
  }

  return client;
}

/**
 * Vérifie un JWT Supabase et retourne l'utilisateur Auth (ou null si invalide).
 * Ne lance jamais d'erreur — mode tolérant.
 */
export async function verifyAccessToken(token: string): Promise<User | null> {
  const admin = getSupabaseAdmin();
  const auth = getSupabaseAuth();
  const client = admin ?? auth;

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
