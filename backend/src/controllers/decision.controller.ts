import type { Request, Response } from 'express';
import type {
  CreerDecisionInput,
  ListerDecisionsQuery,
  ModifierDecisionInput,
} from '../schemas/decision.schemas.js';
import { decisionService } from '../services/decision.service.js';

export class DecisionController {
  async creer(req: Request, res: Response): Promise<void> {
    const data = await decisionService.creer(req.body as CreerDecisionInput);
    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerDecisionsQuery;
    const data = await decisionService.lister(query);
    res.status(200).json({ success: true, data });
  }

  async obtenirParId(req: Request, res: Response): Promise<void> {
    const data = await decisionService.obtenirParId(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await decisionService.modifier(
      req.params.id as string,
      req.body as ModifierDecisionInput,
    );
    res.status(200).json({ success: true, data });
  }

  async supprimer(req: Request, res: Response): Promise<void> {
    await decisionService.supprimer(req.params.id as string);
    res.status(200).json({ success: true, data: { id: req.params.id, supprime: true } });
  }
}

export const decisionController = new DecisionController();
