import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { documentsReunionController } from '../controllers/documents-reunion.controller.js';
import { idParamSchema, uuidSchema } from '../schemas/common.schemas.js';

export const documentsRouter = Router();

const listerQuerySchema = z.object({
  reunion_id: idParamSchema.shape.id,
});

const presenterSchema = z.object({
  reunion_id: uuidSchema,
  document_id: uuidSchema.nullable(),
});

const liveSyncSchema = z.object({
  reunion_id: uuidSchema,
  document_id: uuidSchema.nullable().optional(),
  page: z.number().int().min(1).optional(),
  scroll_ratio: z.number().min(0).max(1).optional(),
});

const reunionIdParamSchema = z.object({
  reunionId: uuidSchema,
});

documentsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateQuery(listerQuerySchema),
  asyncHandler((req, res) => documentsReunionController.lister(req, res)),
);

documentsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  asyncHandler((req, res) => documentsReunionController.televerser(req, res)),
);

documentsRouter.post(
  '/presenter',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateBody(presenterSchema),
  asyncHandler((req, res) => documentsReunionController.presenter(req, res)),
);

documentsRouter.post(
  '/live-sync',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateBody(liveSyncSchema),
  asyncHandler((req, res) => documentsReunionController.synchroniserLive(req, res)),
);

documentsRouter.get(
  '/live/:reunionId',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(reunionIdParamSchema),
  asyncHandler((req, res) => documentsReunionController.obtenirLive(req, res)),
);

documentsRouter.get(
  '/:id/url',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => documentsReunionController.obtenirUrl(req, res)),
);

documentsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => documentsReunionController.supprimer(req, res)),
);
