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

const liveSyncSchema = z.object({
  reunion_id: z.string().uuid(),
  texte_complet: z.string().max(500_000),
  texte_interim: z.string().max(50_000).nullable().optional(),
});

/** Public : permet un échec rapide côté UI sans attendre le timeout WebSocket. */
transcriptionsRouter.get(
  '/stt-status',
  asyncHandler((req, res) => transcriptionsController.statutStt(req, res)),
);

transcriptionsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateBody(sauvegarderSchema),
  asyncHandler((req, res) => transcriptionsController.sauvegarder(req, res)),
);

transcriptionsRouter.post(
  '/live-sync',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateBody(liveSyncSchema),
  asyncHandler((req, res) => transcriptionsController.synchroniserLive(req, res)),
);

transcriptionsRouter.get(
  '/live/:reunionId',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(reunionIdParam),
  asyncHandler((req, res) => transcriptionsController.obtenirLive(req, res)),
);

transcriptionsRouter.get(
  '/reunion/:reunionId',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(reunionIdParam),
  asyncHandler((req, res) => transcriptionsController.listerParReunion(req, res)),
);
