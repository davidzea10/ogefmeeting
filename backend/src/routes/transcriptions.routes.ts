import { Router } from 'express';
import { z } from 'zod';
import { transcriptionsController } from '../controllers/transcriptions.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const transcriptionsRouter = Router();

const sauvegarderSchema = z.object({
  reunion_id: z.string().uuid(),
  langue: z.enum(['fr', 'en', 'fr-FR', 'en-US']).default('fr'),
  texte_complet: z.string().min(1).max(500_000),
  enregistrement_id: z.string().uuid().nullable().optional(),
});

const reunionIdParam = z.object({
  reunionId: idParamSchema.shape.id,
});

transcriptionsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateBody(sauvegarderSchema),
  asyncHandler((req, res) => transcriptionsController.sauvegarder(req, res)),
);

transcriptionsRouter.get(
  '/reunion/:reunionId',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(reunionIdParam),
  asyncHandler((req, res) => transcriptionsController.listerParReunion(req, res)),
);
