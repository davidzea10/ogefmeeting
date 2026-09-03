import {
  FONCTIONS_ORGANISATION,
  MOT_DE_PASSE_DEFAUT,
  ROLES_ASSIGNABLES_ADMIN,
  roleDepuisFonction,
} from '@ogefmeeting/shared';
import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common.schemas.js';

const fonctionSchema = z.enum(FONCTIONS_ORGANISATION).optional().nullable();
const nomObligatoireSchema = z
  .string()
  .trim()
  .min(1, 'Ce champ est obligatoire.')
  .max(100);

export const modifierMonProfilSchema = z
  .object({
    prenom: nomObligatoireSchema.optional(),
    nom: nomObligatoireSchema.optional(),
  })
  .refine((data) => data.prenom !== undefined || data.nom !== undefined, {
    message: 'Au moins le prénom ou le nom doit être fourni.',
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
    prenom: nomObligatoireSchema,
    nom: nomObligatoireSchema,
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
