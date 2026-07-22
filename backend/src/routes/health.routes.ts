import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Routes Health — déclaration des endpoints uniquement (MVC : couche Routes).
 */
export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler((req, res) => healthController.getStatus(req, res)),
);
