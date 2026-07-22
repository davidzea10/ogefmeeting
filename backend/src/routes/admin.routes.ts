import { Router } from 'express';
import {
  directionController,
  modeleController,
  profilController,
  rechercheController,
} from '../controllers/admin.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  creerDirectionSchema,
  creerModeleSchema,
  listerProfilsQuerySchema,
  modifierDirectionSchema,
  modifierModeleSchema,
  modifierProfilSchema,
  rechercheQuerySchema,
} from '../schemas/admin.schemas.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const directionsRouter = Router();
directionsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  asyncHandler((req, res) => directionController.lister(req, res)),
);
directionsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.DIRECTIONS_GERER),
  validateBody(creerDirectionSchema),
  asyncHandler((req, res) => directionController.creer(req, res)),
);
directionsRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.DIRECTIONS_GERER),
  validateParams(idParamSchema),
  validateBody(modifierDirectionSchema),
  asyncHandler((req, res) => directionController.modifier(req, res)),
);

export const profilsRouter = Router();
profilsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.PROFILS_LIRE),
  validateQuery(listerProfilsQuerySchema),
  asyncHandler((req, res) => profilController.lister(req, res)),
);
profilsRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PROFILS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => profilController.obtenirParId(req, res)),
);
profilsRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PROFILS_MODIFIER),
  validateParams(idParamSchema),
  validateBody(modifierProfilSchema),
  asyncHandler((req, res) => profilController.modifier(req, res)),
);

export const modelesRouter = Router();
modelesRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.CR_LIRE),
  asyncHandler((req, res) => modeleController.lister(req, res)),
);
modelesRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.MODELES_GERER),
  validateBody(creerModeleSchema),
  asyncHandler((req, res) => modeleController.creer(req, res)),
);
modelesRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.MODELES_GERER),
  validateParams(idParamSchema),
  validateBody(modifierModeleSchema),
  asyncHandler((req, res) => modeleController.modifier(req, res)),
);

export const rechercheRouter = Router();
rechercheRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.RECHERCHE),
  validateQuery(rechercheQuerySchema),
  asyncHandler((req, res) => rechercheController.rechercher(req, res)),
);
