import { Router } from 'express';
import { actionController } from '../controllers/action.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  creerActionSchema,
  listerActionsQuerySchema,
  modifierActionSchema,
} from '../schemas/action.schemas.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const actionsRouter = Router();

actionsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.ACTIONS_LIRE),
  validateQuery(listerActionsQuerySchema),
  asyncHandler((req, res) => actionController.lister(req, res)),
);

actionsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.ACTIONS_GERER),
  validateBody(creerActionSchema),
  asyncHandler((req, res) => actionController.creer(req, res)),
);

actionsRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.ACTIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => actionController.obtenirParId(req, res)),
);

actionsRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.ACTIONS_GERER),
  validateParams(idParamSchema),
  validateBody(modifierActionSchema),
  asyncHandler((req, res) => actionController.modifier(req, res)),
);

actionsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.ACTIONS_GERER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => actionController.supprimer(req, res)),
);
