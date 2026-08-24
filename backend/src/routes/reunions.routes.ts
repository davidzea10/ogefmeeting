import { Router } from 'express';
import { reunionController } from '../controllers/reunion.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import {
  creerReunionSchema,
  gererOrdreJourSchema,
  gererParticipantsSchema,
  listerReunionsQuerySchema,
  modifierParticipantSchema,
  modifierPointOrdreJourSchema,
  modifierReunionSchema,
  repondreInvitationSchema,
} from '../schemas/reunion.schemas.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { z } from 'zod';

/**
 * Routes Réunions — /api/reunions
 */
export const reunionsRouter = Router();

reunionsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateQuery(listerReunionsQuerySchema),
  asyncHandler((req, res) => reunionController.lister(req, res)),
);

reunionsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_CREER),
  validateBody(creerReunionSchema),
  asyncHandler((req, res) => reunionController.creer(req, res)),
);

/** Doit être déclaré AVANT /:id pour ne pas être capturé comme uuid */
reunionsRouter.post(
  '/teste-live',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  asyncHandler((req, res) => reunionController.preparerTesteLive(req, res)),
);

reunionsRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.obtenirParId(req, res)),
);

reunionsRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_MODIFIER),
  validateParams(idParamSchema),
  validateBody(modifierReunionSchema),
  asyncHandler((req, res) => reunionController.modifier(req, res)),
);

reunionsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_ARCHIVER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.archiver(req, res)),
);

reunionsRouter.post(
  '/:id/demarrer',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.demarrer(req, res)),
);

reunionsRouter.post(
  '/:id/cloturer',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.cloturer(req, res)),
);

reunionsRouter.post(
  '/:id/pause',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.mettreEnPause(req, res)),
);

reunionsRouter.post(
  '/:id/reprendre',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_DEMARRER),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.reprendre(req, res)),
);

reunionsRouter.post(
  '/:id/approuver',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.approuver(req, res)),
);

reunionsRouter.post(
  '/:id/refuser',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(idParamSchema),
  asyncHandler((req, res) => reunionController.refuser(req, res)),
);

reunionsRouter.put(
  '/:id/participants',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_MODIFIER),
  validateParams(idParamSchema),
  validateBody(gererParticipantsSchema),
  asyncHandler((req, res) => reunionController.gererParticipants(req, res)),
);

/** Invité : confirmer ou décliner sa propre invitation */
reunionsRouter.post(
  '/:id/invitation/repondre',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  validateParams(idParamSchema),
  validateBody(repondreInvitationSchema),
  asyncHandler((req, res) => reunionController.repondreInvitation(req, res)),
);

reunionsRouter.put(
  '/:id/ordre-du-jour',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_MODIFIER),
  validateParams(idParamSchema),
  validateBody(gererOrdreJourSchema),
  asyncHandler((req, res) => reunionController.gererOrdreJour(req, res)),
);

const pointParamSchema = z.object({
  id: idParamSchema.shape.id,
  pointId: idParamSchema.shape.id,
});

const participantParamSchema = z.object({
  id: idParamSchema.shape.id,
  participantId: idParamSchema.shape.id,
});

reunionsRouter.patch(
  '/:id/ordre-du-jour/:pointId',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_MODIFIER),
  validateParams(pointParamSchema),
  validateBody(modifierPointOrdreJourSchema),
  asyncHandler((req, res) => reunionController.modifierPoint(req, res)),
);

reunionsRouter.patch(
  '/:id/participants/:participantId',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_MODIFIER),
  validateParams(participantParamSchema),
  validateBody(modifierParticipantSchema),
  asyncHandler((req, res) => reunionController.modifierParticipant(req, res)),
);
