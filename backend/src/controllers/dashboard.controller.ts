import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { profilLimiteAuxParticipations } from '../utils/reunion-acces.js';

export class DashboardController {
  async resume(req: Request, res: Response): Promise<void> {
    const profilId =
      (typeof req.query.profil_id === 'string' ? req.query.profil_id : null) ??
      req.user?.id ??
      null;
    const data = await dashboardService.resume(profilId, {
      limiterReunionsAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    res.status(200).json({ success: true, data });
  }
}

export const dashboardController = new DashboardController();
