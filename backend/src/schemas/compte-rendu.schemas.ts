import { STATUTS_COMPTE_RENDU, TYPES_COMMENTAIRE_CR } from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

export const creerCompteRenduSchema = z.object({
  reunion_id: uuidSchema,
  contenu: z.record(z.string(), z.unknown()).default({}),
  contenu_html: z.string().optional().nullable(),
  cree_par: uuidSchema.optional().nullable(),
});

export type CreerCompteRenduInput = z.infer<typeof creerCompteRenduSchema>;

export const modifierCompteRenduSchema = z
  .object({
    contenu: z.record(z.string(), z.unknown()).optional(),
    contenu_html: z.string().optional().nullable(),
    modifie_par: uuidSchema.optional().nullable(),
    /** true = historiser la version précédente (sauvegarde manuelle). false = auto-save silencieux */
    historiser: z.boolean().optional().default(false),
  })
  .refine((data) => data.contenu !== undefined || data.contenu_html !== undefined, {
    message: 'Au moins contenu ou contenu_html doit être fourni.',
  });

export type ModifierCompteRenduInput = z.infer<typeof modifierCompteRenduSchema>;

export const listerComptesRendusQuerySchema = paginationQuerySchema.extend({
  statut: z.enum(STATUTS_COMPTE_RENDU).optional(),
  reunion_id: uuidSchema.optional(),
  tri: z.enum(['cree_le', 'modifie_le', 'statut', 'version']).default('modifie_le'),
});

export type ListerComptesRendusQuery = z.infer<typeof listerComptesRendusQuerySchema>;

export const soumettreCompteRenduSchema = z.object({
  commentaire: z.string().trim().max(4000).optional().nullable(),
  auteur_id: uuidSchema.optional().nullable(),
});

export type SoumettreCompteRenduInput = z.infer<typeof soumettreCompteRenduSchema>;

export const validerCompteRenduSchema = z.object({
  valide_par: uuidSchema.optional().nullable(),
  commentaire: z.string().trim().max(4000).optional().nullable(),
});

export type ValiderCompteRenduInput = z.infer<typeof validerCompteRenduSchema>;

export const rejeterCompteRenduSchema = z.object({
  /** Motif obligatoire pour le renvoi en révision */
  commentaire: z
    .string()
    .trim()
    .min(5, 'Indiquez un motif d’au moins 5 caractères.')
    .max(4000),
  auteur_id: uuidSchema.optional().nullable(),
});

export type RejeterCompteRenduInput = z.infer<typeof rejeterCompteRenduSchema>;

export const creerCommentaireCrSchema = z.object({
  contenu: z.string().trim().min(1).max(4000),
  type: z.enum(TYPES_COMMENTAIRE_CR).default('note'),
  auteur_id: uuidSchema.optional().nullable(),
});

export type CreerCommentaireCrInput = z.infer<typeof creerCommentaireCrSchema>;
