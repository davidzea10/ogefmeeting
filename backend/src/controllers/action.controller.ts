import type { Request, Response } from 'express';
import type {
  CreerActionInput,
  ListerActionsQuery,
  ModifierActionInput,
} from '../schemas/action.schemas.js';
import { actionService } from '../services/action.service.js';

export class ActionController {
  async creer(req: Request, res: Response): Promise<void> {
    const data = await actionService.creer(req.body as CreerActionInput);
    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerActionsQuery;
    const data = await actionService.lister(query);
    res.status(200).json({ success: true, data });
  }

  async obtenirParId(req: Request, res: Response): Promise<void> {
    const data = await actionService.obtenirParId(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await actionService.modifier(
      req.params.id as string,
      req.body as ModifierActionInput,
    );
    res.status(200).json({ success: true, data });
  }

  async supprimer(req: Request, res: Response): Promise<void> {
    await actionService.supprimer(req.params.id as string);
    res.status(200).json({ success: true, data: { id: req.params.id, supprime: true } });
  }
}

export const actionController = new ActionController();
