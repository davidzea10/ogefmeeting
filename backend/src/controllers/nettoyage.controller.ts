import type { Request, Response } from 'express';
import { nettoyageService } from '../services/nettoyage.service.js';
import { AppError } from '../utils/errors.js';

export class NettoyageController {
  async resume(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const [notifications, reunions] = await Promise.all([
      nettoyageService.compterNotifications(),
      nettoyageService.listerReunionsPourNettoyage(),
    ]);
    res.status(200).json({
      success: true,
      data: {
        notifications,
        reunions,
        reunions_test_live: reunions.filter((r) => r.est_test_live).length,
      },
    });
  }

  async purgerNotifications(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const data = await nettoyageService.purgerToutesNotifications(req.user.id);
    res.status(200).json({ success: true, data });
  }

  async supprimerReunion(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const data = await nettoyageService.supprimerReunionDefinitive(
      req.params.id as string,
      req.user.id,
    );
    res.status(200).json({ success: true, data });
  }

  async supprimerTestsLive(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const data = await nettoyageService.supprimerReunionsTestLive(req.user.id);
    res.status(200).json({ success: true, data });
  }
}

export const nettoyageController = new NettoyageController();
