import { Router } from 'express';
import { utilisateurController } from '../controllers/utilisateur.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { modifierProfilSchema } from '../schemas/admin.schemas.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import {
  inviterUtilisateurSchema,
  listerAuditQuerySchema,
  modifierMonProfilSchema,
} from '../schemas/utilisateur.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

/** Mon profil — /api/profil */
export const profilRouter = Router();

profilRouter.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => utilisateurController.obtenirMonProfil(req, res)),
);

profilRouter.put(
  '/',
  requireAuth,
  validateBody(modifierMonProfilSchema),
  asyncHandler((req, res) => utilisateurController.modifierMonProfil(req, res)),
);

/** Gestion utilisateurs (admin) — /api/utilisateurs */
export const utilisateursRouter = Router();

utilisateursRouter.post(
  '/inviter',
  requireAuth,
  requirePermission(PERMISSIONS.UTILISATEURS_INVITER),
  validateBody(inviterUtilisateurSchema),
  asyncHandler((req, res) => utilisateurController.inviter(req, res)),
);

utilisateursRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PROFILS_MODIFIER),
  validateParams(idParamSchema),
  validateBody(modifierProfilSchema),
  asyncHandler((req, res) => utilisateurController.modifierProfilAdmin(req, res)),
);

utilisateursRouter.post(
  '/:id/desactiver',
  requireAuth,
  requirePermission(PERMISSIONS.UTILISATEURS_INVITER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => utilisateurController.desactiverProfil(req, res)),
);

utilisateursRouter.post(
  '/:id/reactiver',
  requireAuth,
  requirePermission(PERMISSIONS.UTILISATEURS_INVITER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => utilisateurController.reactiverProfil(req, res)),
);

/** Journal d'audit — /api/audit */
export const auditRouter = Router();

auditRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.AUDIT_LIRE),
  validateQuery(listerAuditQuerySchema),
  asyncHandler((req, res) => utilisateurController.listerJournaux(req, res)),
);
