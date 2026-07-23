import {
  FONCTIONS_ORGANISATION,
  MOT_DE_PASSE_DEFAUT,
  ROLES_ASSIGNABLES_ADMIN,
  roleDepuisFonction,
} from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

const fonctionSchema = z.enum(FONCTIONS_ORGANISATION).optional().nullable();
const nomOptionnelSchema = z.string().trim().max(100).optional().default('');

export const modifierMonProfilSchema = z
  .object({
    prenom: nomOptionnelSchema,
    nom: nomOptionnelSchema,
    direction_id: uuidSchema.optional().nullable(),
    fonction: fonctionSchema,
    matricule: z.string().trim().max(40).optional().nullable(),
    url_avatar: z.string().url().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierMonProfilInput = z.infer<typeof modifierMonProfilSchema>;

export const inviterUtilisateurSchema = z
  .object({
    email: z.string().email('Email invalide.'),
    /** Si omis → mot de passe par défaut Ogefrem123! */
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
      .optional(),
    prenom: nomOptionnelSchema,
    nom: nomOptionnelSchema,
    /** Si omis → dérivé de la fonction (agent → membre, chef/dir → directeur) */
    role: z.enum(ROLES_ASSIGNABLES_ADMIN).optional(),
    direction_id: uuidSchema.optional().nullable(),
    fonction: fonctionSchema,
    matricule: z.string().trim().max(40).optional().nullable(),
  })
  .transform((data) => ({
    ...data,
    role: data.role ?? roleDepuisFonction(data.fonction),
  }));

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

export { MOT_DE_PASSE_DEFAUT };
