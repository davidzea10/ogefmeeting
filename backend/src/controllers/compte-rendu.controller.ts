import type { Request, Response } from 'express';
import type {
  CreerCommentaireCrInput,
  CreerCompteRenduInput,
  ListerComptesRendusQuery,
  ModifierCompteRenduInput,
  RejeterCompteRenduInput,
  SoumettreCompteRenduInput,
  ValiderCompteRenduInput,
} from '../schemas/compte-rendu.schemas.js';
import { compteRenduService } from '../services/compte-rendu.service.js';
import { profilLimiteAuxParticipations } from '../utils/reunion-acces.js';

export class CompteRenduController {
  async creer(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.creer(req.body as CreerCompteRenduInput);
    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerComptesRendusQuery;
    const data = await compteRenduService.lister(query, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    res.status(200).json({ success: true, data });
  }

  async obtenirParId(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.obtenirParId(req.params.id as string, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
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
    const data = await compteRenduService.soumettre(
      req.params.id as string,
      (req.body ?? {}) as SoumettreCompteRenduInput,
    );
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
    const data = await compteRenduService.rejeter(
      req.params.id as string,
      req.body as RejeterCompteRenduInput,
    );
    res.status(200).json({ success: true, data });
  }

  async archiver(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.archiver(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async listerCommentaires(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.listerCommentaires(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async ajouterCommentaire(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.ajouterCommentaire(
      req.params.id as string,
      req.body as CreerCommentaireCrInput,
    );
    res.status(201).json({ success: true, data });
  }

  async listerVersions(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.listerVersions(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async exporter(req: Request, res: Response): Promise<void> {
    const data = await compteRenduService.exporter(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async exporterPdf(req: Request, res: Response): Promise<void> {
    const { buffer, filename } = await compteRenduService.exporterPdf(
      req.params.id as string,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).send(buffer);
  }
}

export const compteRenduController = new CompteRenduController();
