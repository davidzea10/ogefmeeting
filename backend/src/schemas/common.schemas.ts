import { z } from 'zod';

/**
 * Schémas Zod communs (pagination, UUID, etc.).
 * Les schémas métier (réunions, CR…) arriveront aux étapes 3.3+.
 */

export const uuidSchema = z.string().uuid('Identifiant UUID invalide.');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  tri: z.string().optional(),
  ordre: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const idParamSchema = z.object({
  id: uuidSchema,
});

export type IdParam = z.infer<typeof idParamSchema>;
