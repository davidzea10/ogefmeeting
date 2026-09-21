import type { Request, Response } from 'express';
import { crParticulierService } from '../services/cr-particulier.service.js';
import { AppError } from '../utils/errors.js';

export class CrParticulierController {
  meta(_req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      data: crParticulierService.obtenirMeta(),
    });
  }

  async generer(_req: Request, res: Response): Promise<void> {
    // Multi-passes GPT (un appel par grand point) — jusqu’à ~10 min
    res.setTimeout(10 * 60 * 1000);
    const data = await crParticulierService.genererTresDetaille();
    res.status(200).json({ success: true, data });
  }

  async pdf(req: Request, res: Response): Promise<void> {
    const body = req.body as {
      contenu?: Record<string, string>;
      contenu_html?: string;
    };
    if (!body?.contenu || !body?.contenu_html) {
      throw new AppError(
        400,
        'Générez d’abord le CR particulier, puis exportez le PDF.',
      );
    }
    const buffer = await crParticulierService.genererPdfDepuisBrouillon({
      contenu: body.contenu,
      contenu_html: body.contenu_html,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cr-particulier-pads-sygren.pdf"',
    );
    res.status(200).send(buffer);
  }
}

export const crParticulierController = new CrParticulierController();
