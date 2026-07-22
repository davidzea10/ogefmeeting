import type { Request } from 'express';
import { TABLES } from '@ogefmeeting/shared';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

export type AuditPayload = {
  action: string;
  profil_id?: string | null;
  type_entite?: string | null;
  entite_id?: string | null;
  metadonnees?: Record<string, unknown>;
  req?: Request;
};

/**
 * Journalise une action dans journaux_audit.
 * Non bloquant : une erreur d'audit ne fait jamais échouer la requête métier.
 */
export async function enregistrerAudit(payload: AuditPayload): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const ip =
    (payload.req?.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    payload.req?.socket.remoteAddress ??
    null;

  const { error } = await supabase.from(TABLES.journauxAudit).insert({
    profil_id: payload.profil_id ?? null,
    action: payload.action,
    type_entite: payload.type_entite ?? null,
    entite_id: payload.entite_id ?? null,
    metadonnees: payload.metadonnees ?? {},
    adresse_ip: ip,
  });

  if (error) {
    logger.warn({ err: error, action: payload.action }, 'Échec journal audit (non bloquant)');
  }
}
