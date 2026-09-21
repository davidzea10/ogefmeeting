import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requireAdministrateur } from '../middleware/auth.js';
import { crParticulierController } from '../controllers/cr-particulier.controller.js';

/** CR particulier (admin) — /api/admin/cr-particulier */
export const crParticulierRouter = Router();

crParticulierRouter.use(requireAuth, requireAdministrateur);

crParticulierRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    crParticulierController.meta(req, res);
  }),
);

crParticulierRouter.post(
  '/generer',
  asyncHandler((req, res) => crParticulierController.generer(req, res)),
);

crParticulierRouter.post(
  '/pdf',
  asyncHandler((req, res) => crParticulierController.pdf(req, res)),
);
