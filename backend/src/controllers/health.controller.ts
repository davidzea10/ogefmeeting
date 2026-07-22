import type { Request, Response } from 'express';
import { healthService } from '../services/health.service.js';

/**
 * Contrôleur Health — reçoit la requête HTTP, appelle le service, renvoie la réponse.
 * Pas de logique métier ici (MVC : couche Controller).
 */
export class HealthController {
  async getStatus(_req: Request, res: Response): Promise<void> {
    const data = await healthService.getStatus();

    res.status(200).json({
      success: true,
      data,
    });
  }
}

export const healthController = new HealthController();
