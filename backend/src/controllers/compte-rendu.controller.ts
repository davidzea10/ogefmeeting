import type { Request, Response } from 'express';
import type {
  CreerCompteRenduInput,
  ListerComptesRendusQuery,
  ModifierCompteRenduInput,
  ValiderCompteRenduInput,
} from '../schemas/compte-rendu.schemas.js';
import { compteRenduService } from '../services/compte-rendu.service.js';

export class CompteRenduController {
  async creer(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.creer(req.body as CreerCompteRenduInput);
    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerComptesRendusQuery;
    const data = await compteRenduService.lister(query);
    res.status(200).json({ success: true, data });
  }

  async obtenirParId(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.obtenirParId(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.modifier(
      req.params.id as string,
      req.body as ModifierCompteRenduInput,
    );
    res.status(200).json({ success: true, data });
  }

  async soumettre(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.soumettre(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async valider(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.valider(
      req.params.id as string,
      (req.body ?? {}) as ValiderCompteRenduInput,
    );
    res.status(200).json({ success: true, data });
  }

  async rejeter(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.rejeter(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async listerVersions(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.listerVersions(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async exporter(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.exporter(req.params.id as string);
    res.status(200).json({ success: true, data });
  }
}

export const compteRenduController = new CompteRenduController();
