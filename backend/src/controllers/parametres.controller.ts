import type { Request, Response } from 'express';
import type {
  ListerNotificationsQuery,
  ModifierParametresInput,
} from '../schemas/parametres.schemas.js';
import { notificationService } from '../services/notification.service.js';
import { parametresService } from '../services/parametres.service.js';
import { AppError } from '../utils/errors.js';

export class ParametresController {
  async obtenir(_req: Request, res: Response): Promise<void> {
    const data = await parametresService.obtenir();
    res.status(200).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await parametresService.modifier(
      req.body as ModifierParametresInput,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }
}

export class NotificationController {
  async lister(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const query = (req.validated?.query ?? req.query) as ListerNotificationsQuery;
    const data = await notificationService.lister(req.user.id, query);
    res.status(200).json({ success: true, data });
  }

  async compterNonLues(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    // Best-effort : rappels actions en retard (max 1x / action / jour)
    await notificationService.notifierActionsEnRetard().catch(() => 0);
    const count = await notificationService.compterNonLues(req.user.id);
    res.status(200).json({ success: true, data: { non_lues: count } });
  }

  async marquerLue(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const data = await notificationService.marquerLue(
      req.user.id,
      req.params.id as string,
    );
    res.status(200).json({ success: true, data });
  }

  async marquerToutesLues(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const data = await notificationService.marquerToutesLues(req.user.id);
    res.status(200).json({ success: true, data });
  }
}

export const parametresController = new ParametresController();
export const notificationController = new NotificationController();
