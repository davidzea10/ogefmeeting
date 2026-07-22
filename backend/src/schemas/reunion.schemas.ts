import {
  STATUTS_PARTICIPANT,
  STATUTS_REUNION,
  TYPES_REUNION,
} from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

export const creerReunionSchema = z.object({
  titre: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caractères.'),
  description: z.string().trim().optional().nullable(),
  type_reunion: z.enum(TYPES_REUNION).default('autre'),
  date_prevue: z.string().datetime({ message: 'date_prevue doit être une date ISO valide.' }),
  lieu: z.string().trim().optional().nullable(),
  direction_id: uuidSchema.optional().nullable(),
  modele_id: uuidSchema.optional().nullable(),
  /** Optionnel tant que l'auth JWT n'est pas en place (étape 4) */
  cree_par: uuidSchema.optional().nullable(),
});

export type CreerReunionInput = z.infer<typeof creerReunionSchema>;

export const modifierReunionSchema = z
  .object({
    titre: z.string().trim().min(3).optional(),
    description: z.string().trim().optional().nullable(),
    type_reunion: z.enum(TYPES_REUNION).optional(),
    date_prevue: z
      .string()
      .datetime({ message: 'date_prevue doit être une date ISO valide.' })
      .optional(),
    lieu: z.string().trim().optional().nullable(),
    direction_id: uuidSchema.optional().nullable(),
    modele_id: uuidSchema.optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierReunionInput = z.infer<typeof modifierReunionSchema>;

export const listerReunionsQuerySchema = paginationQuerySchema.extend({
  statut: z.enum(STATUTS_REUNION).optional(),
  type_reunion: z.enum(TYPES_REUNION).optional(),
  direction_id: uuidSchema.optional(),
  recherche: z.string().trim().optional(),
  tri: z
    .enum(['date_prevue', 'titre', 'statut', 'cree_le'])
    .default('date_prevue'),
});

export type ListerReunionsQuery = z.infer<typeof listerReunionsQuerySchema>;

export const participantInputSchema = z.object({
  profil_id: uuidSchema,
  statut: z.enum(STATUTS_PARTICIPANT).default('invite'),
});

export const gererParticipantsSchema = z.object({
  participants: z
    .array(participantInputSchema)
    .min(1, 'Au moins un participant est requis.'),
});

export type GererParticipantsInput = z.infer<typeof gererParticipantsSchema>;

export const pointOrdreJourInputSchema = z.object({
  titre: z.string().trim().min(2, 'Le titre du point est trop court.'),
  description: z.string().trim().optional().nullable(),
  ordre: z.number().int().min(0).optional(),
  duree_minutes: z.number().int().min(1).optional().nullable(),
});

export const gererOrdreJourSchema = z.object({
  points: z.array(pointOrdreJourInputSchema).min(1, 'Au moins un point est requis.'),
});

export type GererOrdreJourInput = z.infer<typeof gererOrdreJourSchema>;
