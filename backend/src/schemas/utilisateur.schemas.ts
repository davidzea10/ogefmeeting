import { ROLES_UTILISATEUR } from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

export const modifierMonProfilSchema = z
  .object({
    prenom: z.string().trim().min(1).optional(),
    nom: z.string().trim().min(1).optional(),
    direction_id: uuidSchema.optional().nullable(),
    fonction: z.string().trim().optional().nullable(),
    url_avatar: z.string().url().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierMonProfilInput = z.infer<typeof modifierMonProfilSchema>;

export const inviterUtilisateurSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe temporaire doit contenir au moins 8 caractères.')
    .optional(),
  prenom: z.string().trim().min(1),
  nom: z.string().trim().min(1),
  role: z.enum(ROLES_UTILISATEUR).default('participant'),
  direction_id: uuidSchema.optional().nullable(),
  fonction: z.string().trim().optional().nullable(),
});

export type InviterUtilisateurInput = z.infer<typeof inviterUtilisateurSchema>;

export const modifierMotDePasseSchema = z.object({
  nouveau_mot_de_passe: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
});

export type ModifierMotDePasseInput = z.infer<typeof modifierMotDePasseSchema>;

export const motDePasseOublieSchema = z.object({
  email: z.string().email('Email invalide.'),
});

export type MotDePasseOublieInput = z.infer<typeof motDePasseOublieSchema>;

export const listerAuditQuerySchema = paginationQuerySchema.extend({
  profil_id: uuidSchema.optional(),
  action: z.string().trim().optional(),
  tri: z.enum(['cree_le', 'action']).default('cree_le'),
});

export type ListerAuditQuery = z.infer<typeof listerAuditQuerySchema>;
