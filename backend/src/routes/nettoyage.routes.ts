import { Router } from 'express';
import { nettoyageController } from '../controllers/nettoyage.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requireAdministrateur } from '../middleware/auth.js';
import { validateParams } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';

/** Nettoyage admin — /api/admin/nettoyage */
export const nettoyageRouter = Router();

nettoyageRouter.use(requireAuth, requireAdministrateur);

nettoyageRouter.get(
  '/',
  asyncHandler((req, res) => nettoyageController.resume(req, res)),
);

nettoyageRouter.post(
  '/notifications/purger',
  asyncHandler((req, res) => nettoyageController.purgerNotifications(req, res)),
);

nettoyageRouter.post(
  '/reunions-test-live/purger',
  asyncHandler((req, res) => nettoyageController.supprimerTestsLive(req, res)),
);

nettoyageRouter.delete(
  '/reunions/:id',
  validateParams(idParamSchema),
  asyncHandler((req, res) => nettoyageController.supprimerReunion(req, res)),
);
