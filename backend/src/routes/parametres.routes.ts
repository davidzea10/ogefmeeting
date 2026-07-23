import { Router } from 'express';
import {
  notificationController,
  parametresController,
} from '../controllers/parametres.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import {
  listerNotificationsQuerySchema,
  modifierParametresSchema,
} from '../schemas/parametres.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

/** Paramètres généraux — /api/parametres */
export const parametresRouter = Router();

parametresRouter.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => parametresController.obtenir(req, res)),
);

parametresRouter.put(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.PARAMETRES_GERER),
  validateBody(modifierParametresSchema),
  asyncHandler((req, res) => parametresController.modifier(req, res)),
);

/** Notifications — /api/notifications */
export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  requireAuth,
  validateQuery(listerNotificationsQuerySchema),
  asyncHandler((req, res) => notificationController.lister(req, res)),
);

notificationsRouter.get(
  '/non-lues',
  requireAuth,
  asyncHandler((req, res) => notificationController.compterNonLues(req, res)),
);

notificationsRouter.post(
  '/lire-toutes',
  requireAuth,
  asyncHandler((req, res) => notificationController.marquerToutesLues(req, res)),
);

notificationsRouter.post(
  '/:id/lire',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler((req, res) => notificationController.marquerLue(req, res)),
);
