import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

export const creerDecisionSchema = z.object({
  reunion_id: uuidSchema,
  titre: z.string().trim().min(3),
  description: z.string().trim().optional().nullable(),
  compte_rendu_id: uuidSchema.optional().nullable(),
  decide_le: z.string().datetime().optional(),
  cree_par: uuidSchema.optional().nullable(),
});

export type CreerDecisionInput = z.infer<typeof creerDecisionSchema>;

export const modifierDecisionSchema = z
  .object({
    titre: z.string().trim().min(3).optional(),
    description: z.string().trim().optional().nullable(),
    decide_le: z.string().datetime().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierDecisionInput = z.infer<typeof modifierDecisionSchema>;

export const listerDecisionsQuerySchema = paginationQuerySchema.extend({
  reunion_id: uuidSchema.optional(),
  compte_rendu_id: uuidSchema.optional(),
  tri: z.enum(['decide_le', 'cree_le', 'titre']).default('decide_le'),
});

export type ListerDecisionsQuery = z.infer<typeof listerDecisionsQuerySchema>;
