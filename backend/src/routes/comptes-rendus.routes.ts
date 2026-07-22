import { Router } from 'express';
import { compteRenduController } from '../controllers/compte-rendu.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import {
  creerCompteRenduSchema,
  listerComptesRendusQuerySchema,
  modifierCompteRenduSchema,
  validerCompteRenduSchema,
} from '../schemas/compte-rendu.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const comptesRendusRouter = Router();

comptesRendusRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.CR_LIRE),
  validateQuery(listerComptesRendusQuerySchema),
  asyncHandler((req, res) => compteRenduController.lister(req, res)),
);

comptesRendusRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.CR_CREER),
  validateBody(creerCompteRenduSchema),
  asyncHandler((req, res) => compteRenduController.creer(req, res)),
);

comptesRendusRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.CR_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => compteRenduController.obtenirParId(req, res)),
);

comptesRendusRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.CR_MODIFIER),
  validateParams(idParamSchema),
  validateBody(modifierCompteRenduSchema),
  asyncHandler((req, res) => compteRenduController.modifier(req, res)),
);

comptesRendusRouter.post(
  '/:id/soumettre',
  requireAuth,
  requirePermission(PERMISSIONS.CR_MODIFIER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => compteRenduController.soumettre(req, res)),
);

comptesRendusRouter.post(
  '/:id/valider',
  requireAuth,
  requirePermission(PERMISSIONS.CR_VALIDER),
  validateParams(idParamSchema),
  validateBody(validerCompteRenduSchema),
  asyncHandler((req, res) => compteRenduController.valider(req, res)),
);

comptesRendusRouter.post(
  '/:id/rejeter',
  requireAuth,
  requirePermission(PERMISSIONS.CR_VALIDER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => compteRenduController.rejeter(req, res)),
);

comptesRendusRouter.get(
  '/:id/versions',
  requireAuth,
  requirePermission(PERMISSIONS.CR_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => compteRenduController.listerVersions(req, res)),
);

comptesRendusRouter.get(
  '/:id/export',
  requireAuth,
  requirePermission(PERMISSIONS.CR_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => compteRenduController.exporter(req, res)),
);

comptesRendusRouter.get(
  '/:id/export/pdf',
  requireAuth,
  requirePermission(PERMISSIONS.CR_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => compteRenduController.exporter(req, res)),
);
