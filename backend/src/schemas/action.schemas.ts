import { PRIORITES_ACTION, STATUTS_ACTION } from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

export const creerActionSchema = z.object({
  reunion_id: uuidSchema,
  titre: z.string().trim().min(3),
  description: z.string().trim().optional().nullable(),
  responsable_id: uuidSchema.optional().nullable(),
  priorite: z.enum(PRIORITES_ACTION).default('moyenne'),
  statut: z.enum(STATUTS_ACTION).default('en_attente'),
  date_echeance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_echeance doit être au format YYYY-MM-DD')
    .optional()
    .nullable(),
  compte_rendu_id: uuidSchema.optional().nullable(),
  decision_id: uuidSchema.optional().nullable(),
  cree_par: uuidSchema.optional().nullable(),
});

export type CreerActionInput = z.infer<typeof creerActionSchema>;

export const modifierActionSchema = z
  .object({
    titre: z.string().trim().min(3).optional(),
    description: z.string().trim().optional().nullable(),
    responsable_id: uuidSchema.optional().nullable(),
    priorite: z.enum(PRIORITES_ACTION).optional(),
    statut: z.enum(STATUTS_ACTION).optional(),
    date_echeance: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_echeance doit être au format YYYY-MM-DD')
      .optional()
      .nullable(),
    decision_id: uuidSchema.optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierActionInput = z.infer<typeof modifierActionSchema>;

export const listerActionsQuerySchema = paginationQuerySchema.extend({
  statut: z.enum(STATUTS_ACTION).optional(),
  priorite: z.enum(PRIORITES_ACTION).optional(),
  reunion_id: uuidSchema.optional(),
  responsable_id: uuidSchema.optional(),
  tri: z.enum(['date_echeance', 'cree_le', 'priorite', 'statut']).default('date_echeance'),
});

export type ListerActionsQuery = z.infer<typeof listerActionsQuerySchema>;
