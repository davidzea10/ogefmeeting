import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { enregistrementsController } from '../controllers/enregistrements.controller.js';
import { idParamSchema } from '../schemas/common.schemas.js';

/**
 * Routes Enregistrements — /api/enregistrements
 */
export const enregistrementsRouter = Router();

const listerQuerySchema = z.object({
  reunion_id: idParamSchema.shape.id,
});

enregistrementsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateQuery(listerQuerySchema),
  asyncHandler((req, res) => enregistrementsController.lister(req, res)),
);

enregistrementsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  asyncHandler((req, res) => enregistrementsController.televerser(req, res)),
);

enregistrementsRouter.get(
  '/:id/url',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => enregistrementsController.obtenirUrlLecture(req, res)),
);

enregistrementsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => enregistrementsController.supprimer(req, res)),
);
