import { Router } from 'express';
import { decisionController } from '../controllers/decision.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import {
  creerDecisionSchema,
  listerDecisionsQuerySchema,
  modifierDecisionSchema,
} from '../schemas/decision.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const decisionsRouter = Router();

decisionsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.DECISIONS_LIRE),
  validateQuery(listerDecisionsQuerySchema),
  asyncHandler((req, res) => decisionController.lister(req, res)),
);

decisionsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.DECISIONS_GERER),
  validateBody(creerDecisionSchema),
  asyncHandler((req, res) => decisionController.creer(req, res)),
);

decisionsRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.DECISIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => decisionController.obtenirParId(req, res)),
);

decisionsRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.DECISIONS_GERER),
  validateParams(idParamSchema),
  validateBody(modifierDecisionSchema),
  asyncHandler((req, res) => decisionController.modifier(req, res)),
);

decisionsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.DECISIONS_GERER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => decisionController.supprimer(req, res)),
);
