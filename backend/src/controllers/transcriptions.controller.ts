import type { Request, Response } from 'express';
import { transcriptionsService } from '../services/transcriptions.service.js';
import { reunionService } from '../services/reunion.service.js';
import { AppError } from '../utils/errors.js';
import {
  utilisateurPeutApprouver,
  utilisateurPeutGererConduite,
} from '../utils/reunion-acces.js';

function peutVoirArchives(
  user: Request['user'],
  creePar: string | null,
): boolean {
  if (!user) return false;
  if (user.role === 'administrateur') return true;
  if (creePar && user.id === creePar) return true;
  return utilisateurPeutApprouver(user);
}

/**
 * Contrôleur Transcriptions.
 */
export class TranscriptionsController {
  async sauvegarder(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');

    const body = req.body as {
      reunion_id: string;
      langue: string;
      texte_complet: string;
      enregistrement_id?: string | null;
    };

    const reunion = await reunionService.obtenirParId(body.reunion_id);
    if (!utilisateurPeutGererConduite(req.user, reunion)) {
      throw new AppError(403, 'Droits insuffisants pour sauvegarder une transcription.');
    }

    const data = await transcriptionsService.sauvegarder(body);
    res.status(201).json({ success: true, data });
  }

  async listerParReunion(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const reunionId = req.params.reunionId as string;
    const reunion = await reunionService.obtenirParId(reunionId);

    if (!peutVoirArchives(req.user, reunion.cree_par)) {
      throw new AppError(
        403,
        'Seuls l’administrateur ou l’organisateur peuvent consulter les transcriptions.',
      );
    }

    const data = await transcriptionsService.listerParReunion(reunionId);
    res.status(200).json({ success: true, data });
  }
}

export const transcriptionsController = new TranscriptionsController();
