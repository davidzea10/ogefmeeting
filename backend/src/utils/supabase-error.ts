import type { PostgrestError } from '@supabase/supabase-js';
import { AppError } from './errors.js';
import { logger } from '../lib/logger.js';

/**
 * Convertit une erreur PostgREST / Supabase en AppError HTTP.
 */
export function handleSupabaseError(
  error: PostgrestError,
  fallbackMessage = 'Erreur base de données',
): never {
  logger.error(
    {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    },
    'Erreur Supabase',
  );

  // Conflit d'unicité
  if (error.code === '23505') {
    throw new AppError(409, 'Conflit : cet enregistrement existe déjà.', {
      code: error.code,
      details: error.details,
    });
  }

  // Violation de clé étrangère
  if (error.code === '23503') {
    throw new AppError(400, 'Référence invalide (clé étrangère).', {
      code: error.code,
      details: error.details,
    });
  }

  // Ligne non trouvée (selon usage .single())
  if (error.code === 'PGRST116') {
    throw new AppError(404, 'Ressource introuvable.', {
      code: error.code,
    });
  }

  throw new AppError(500, fallbackMessage, {
    code: error.code,
    message: error.message,
  });
}
