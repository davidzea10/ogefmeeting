import type { Request, Response } from 'express';
import { reunionDirectementPlanifiee } from '@ogefmeeting/shared';
import type {
  CreerReunionInput,
  GererOrdreJourInput,
  GererParticipantsInput,
  ListerReunionsQuery,
  ModifierReunionInput,
} from '../schemas/reunion.schemas.js';
import { reunionService } from '../services/reunion.service.js';
import { AppError } from '../utils/errors.js';
import {
  profilLimiteAuxParticipations,
  utilisateurPeutApprouver,
} from '../utils/reunion-acces.js';

/**
 * Contrôleur Réunions — couche HTTP (MVC).
 */
export class ReunionController {
  async creer(req: Request, res: Response): Promise<void> {
    const body = req.body as CreerReunionInput;
    const directementPlanifiee = reunionDirectementPlanifiee(
      req.user?.role,
      req.user?.fonction,
    );
    const data = await reunionService.creer(
      {
        ...body,
        cree_par: body.cree_par ?? req.user?.id ?? null,
      },
      { directementPlanifiee },
    );
    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerReunionsQuery;
    const data = await reunionService.lister(query, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    res.status(200).json({ success: true, data });
  }

  async obtenirParId(req: Request, res: Response): Promise<void> {
    const data = await reunionService.obtenirParId(req.params.id as string, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    res.status(200).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await reunionService.modifier(
      req.params.id as string,
      req.body as ModifierReunionInput,
    );
    res.status(200).json({ success: true, data });
  }

  async archiver(req: Request, res: Response): Promise<void> {
    const data = await reunionService.archiver(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async demarrer(req: Request, res: Response): Promise<void> {
    const data = await reunionService.demarrer(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async cloturer(req: Request, res: Response): Promise<void> {
    const data = await reunionService.cloturer(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async approuver(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(403, 'Seul un directeur peut valider une réunion.');
    }
    const data = await reunionService.approuver(
      req.params.id as string,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }

  async refuser(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(403, 'Seul un directeur peut refuser une réunion.');
    }
    const data = await reunionService.refuser(
      req.params.id as string,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }

  async gererParticipants(req: Request, res: Response): Promise<void> {
    const data = await reunionService.gererParticipants(
      req.params.id as string,
      req.body as GererParticipantsInput,
    );
    res.status(200).json({ success: true, data });
  }

  async gererOrdreJour(req: Request, res: Response): Promise<void> {
    const data = await reunionService.gererOrdreJour(
      req.params.id as string,
      req.body as GererOrdreJourInput,
    );
    res.status(200).json({ success: true, data });
  }

  async modifierPoint(req: Request, res: Response): Promise<void> {
    const data = await reunionService.modifierPoint(
      req.params.id as string,
      req.params.pointId as string,
      (req.body as { est_traite: boolean }).est_traite,
    );
    res.status(200).json({ success: true, data });
  }

  async modifierParticipant(req: Request, res: Response): Promise<void> {
    const data = await reunionService.modifierParticipant(
      req.params.id as string,
      req.params.participantId as string,
      (req.body as { statut: string }).statut,
    );
    res.status(200).json({ success: true, data });
  }
}

export const reunionController = new ReunionController();
