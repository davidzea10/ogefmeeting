import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { utilisateurController } from '../controllers/utilisateur.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  connexionSchema,
  inscriptionSchema,
  rafraichirSchema,
} from '../schemas/auth.schemas.js';
import {
  modifierMotDePasseSchema,
  motDePasseOublieSchema,
} from '../schemas/utilisateur.schemas.js';
import { env } from '../config/env.js';

export const authRouter = Router();

authRouter.post(
  '/inscription',
  ...(env.AUTH_ENFORCED ? [requireAuth, requireRoles('administrateur')] : []),
  validateBody(inscriptionSchema),
  asyncHandler((req, res) => authController.inscription(req, res)),
);

authRouter.post(
  '/connexion',
  validateBody(connexionSchema),
  asyncHandler((req, res) => authController.connexion(req, res)),
);

authRouter.post(
  '/rafraichir',
  validateBody(rafraichirSchema),
  asyncHandler((req, res) => authController.rafraichir(req, res)),
);

authRouter.get(
  '/moi',
  asyncHandler((req, res) => authController.moi(req, res)),
);

authRouter.post(
  '/deconnexion',
  asyncHandler((req, res) => authController.deconnexion(req, res)),
);

authRouter.post(
  '/mot-de-passe',
  requireAuth,
  validateBody(modifierMotDePasseSchema),
  asyncHandler((req, res) => utilisateurController.changerMotDePasse(req, res)),
);

authRouter.post(
  '/mot-de-passe/oublie',
  validateBody(motDePasseOublieSchema),
  asyncHandler((req, res) => utilisateurController.motDePasseOublie(req, res)),
);
