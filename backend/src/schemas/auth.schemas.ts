import { ROLES_UTILISATEUR } from '@ogefmeeting/shared';
import { z } from 'zod';

export const inscriptionSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
  prenom: z.string().trim().min(1).default('Utilisateur'),
  nom: z.string().trim().min(1).default('OGEFREM'),
  role: z.enum(ROLES_UTILISATEUR).optional().default('participant'),
  direction_id: z.string().uuid().optional().nullable(),
  fonction: z.string().trim().optional().nullable(),
});

export type InscriptionInput = z.infer<typeof inscriptionSchema>;

export const connexionSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
});

export type ConnexionInput = z.infer<typeof connexionSchema>;

export const rafraichirSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token requis.'),
});

export type RafraichirInput = z.infer<typeof rafraichirSchema>;
