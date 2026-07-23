import { z } from 'zod';
import { paginationQuerySchema } from './common.schemas.js';

export const modifierParametresSchema = z
  .object({
    logo_url: z
      .union([z.string().url('URL du logo invalide.'), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    en_tete_pdf: z.string().trim().min(3).max(200).optional(),
    sous_titre_pdf: z.string().trim().min(3).max(200).optional(),
    duree_retention_jours: z.coerce.number().int().min(30).max(3650).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être fourni.',
  });

export type ModifierParametresInput = z.infer<typeof modifierParametresSchema>;

export const listerNotificationsQuerySchema = paginationQuerySchema.extend({
  non_lues: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type ListerNotificationsQuery = z.infer<typeof listerNotificationsQuerySchema>;
