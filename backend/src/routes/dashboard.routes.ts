import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/permissions.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/resume',
  requireAuth,
  requirePermission(PERMISSIONS.REUNIONS_LIRE),
  asyncHandler((req, res) => dashboardController.resume(req, res)),
);
