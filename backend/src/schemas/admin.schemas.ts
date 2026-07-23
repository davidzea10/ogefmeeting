import {
  FONCTIONS_ORGANISATION,
  ROLES_UTILISATEUR,
} from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

const fonctionSchema = z.enum(FONCTIONS_ORGANISATION).optional().nullable();
const nomOptionnelSchema = z.string().trim().max(100).optional();

export const creerDirectionSchema = z.object({
  nom: z.string().trim().min(2),
  code: z.string().trim().min(2).max(20).optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

export type CreerDirectionInput = z.infer<typeof creerDirectionSchema>;

export const modifierDirectionSchema = z
  .object({
    nom: z.string().trim().min(2).optional(),
    code: z.string().trim().min(2).max(20).optional().nullable(),
    description: z.string().trim().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierDirectionInput = z.infer<typeof modifierDirectionSchema>;

export const modifierProfilSchema = z
  .object({
    prenom: nomOptionnelSchema,
    nom: nomOptionnelSchema,
    direction_id: uuidSchema.optional().nullable(),
    fonction: fonctionSchema,
    matricule: z.string().trim().max(40).optional().nullable(),
    url_avatar: z.string().url().optional().nullable(),
    role: z.enum(ROLES_UTILISATEUR).optional(),
    est_actif: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierProfilInput = z.infer<typeof modifierProfilSchema>;

export const listerProfilsQuerySchema = paginationQuerySchema.extend({
  role: z.enum(ROLES_UTILISATEUR).optional(),
  direction_id: uuidSchema.optional(),
  est_actif: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  recherche: z.string().trim().optional(),
  tri: z.enum(['nom', 'prenom', 'email', 'cree_le']).default('nom'),
});

export type ListerProfilsQuery = z.infer<typeof listerProfilsQuerySchema>;

export const creerModeleSchema = z.object({
  nom: z.string().trim().min(2),
  identifiant: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9_]+$/, 'identifiant: lettres minuscules, chiffres et _ uniquement'),
  description: z.string().trim().optional().nullable(),
  sections: z
    .array(
      z.object({
        cle: z.string().min(1),
        libelle: z.string().min(1),
      }),
    )
    .default([]),
  est_par_defaut: z.boolean().default(false),
});

export type CreerModeleInput = z.infer<typeof creerModeleSchema>;

export const modifierModeleSchema = z
  .object({
    nom: z.string().trim().min(2).optional(),
    description: z.string().trim().optional().nullable(),
    sections: z
      .array(
        z.object({
          cle: z.string().min(1),
          libelle: z.string().min(1),
        }),
      )
      .optional(),
    est_par_defaut: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierModeleInput = z.infer<typeof modifierModeleSchema>;

export const rechercheQuerySchema = z.object({
  q: z.string().trim().min(2, 'La recherche doit contenir au moins 2 caractères.'),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});

export type RechercheQuery = z.infer<typeof rechercheQuerySchema>;
