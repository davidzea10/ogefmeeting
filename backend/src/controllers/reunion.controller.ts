import type { Request, Response } from 'express';
import { reunionDirectementPlanifiee } from '@ogefmeeting/shared';
import type {
  CreerReunionInput,
  GererOrdreJourInput,
  GererParticipantsInput,
  ListerReunionsQuery,
  ModifierReunionInput,
  RepondreInvitationInput,
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
    await this.assurerPeutEditerReunion(req, req.params.id as string);
    const data = await reunionService.modifier(
      req.params.id as string,
      req.body as ModifierReunionInput,
    );
    res.status(200).json({ success: true, data });
  }

  async archiver(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(
        403,
        'Seuls un secrétaire, chef de service, sous-directeur ou directeur peuvent archiver une réunion.',
      );
    }
    const data = await reunionService.archiver(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async demarrer(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(
        403,
        'Seuls un secrétaire, chef de service, sous-directeur ou directeur peuvent démarrer une réunion.',
      );
    }
    const data = await reunionService.demarrer(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  /** Admin uniquement — crée / réutilise une réunion live DANTIC pour tests audio/IA. */
  async preparerTesteLive(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    if (req.user.role !== 'administrateur') {
      throw new AppError(403, 'Réservé aux administrateurs.');
    }
    const data = await reunionService.preparerTesteLive(req.user.id);
    res.status(200).json({ success: true, data });
  }

  async cloturer(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(
        403,
        'Seuls un secrétaire, chef de service, sous-directeur ou directeur peuvent clôturer une réunion.',
      );
    }
    const data = await reunionService.cloturer(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async mettreEnPause(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(403, 'Droits insuffisants pour mettre la réunion en pause.');
    }
    const data = await reunionService.mettreEnPause(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async reprendre(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(403, 'Droits insuffisants pour reprendre la réunion.');
    }
    const data = await reunionService.reprendre(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async approuver(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(403, 'Vous n’avez pas le droit de valider une réunion.');
    }
    const data = await reunionService.approuver(
      req.params.id as string,
      req.user?.id,
      {
        role: req.user?.role,
        fonction: req.user?.fonction,
        direction_id: req.user?.direction_id,
      },
    );
    res.status(200).json({ success: true, data });
  }

  async refuser(req: Request, res: Response): Promise<void> {
    if (!utilisateurPeutApprouver(req.user)) {
      throw new AppError(403, 'Vous n’avez pas le droit de refuser une réunion.');
    }
    const data = await reunionService.refuser(
      req.params.id as string,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }

  async gererParticipants(req: Request, res: Response): Promise<void> {
    await this.assurerPeutEditerReunion(req, req.params.id as string);
    const data = await reunionService.gererParticipants(
      req.params.id as string,
      req.body as GererParticipantsInput,
    );
    res.status(200).json({ success: true, data });
  }

  async gererOrdreJour(req: Request, res: Response): Promise<void> {
    await this.assurerPeutEditerReunion(req, req.params.id as string);
    const data = await reunionService.gererOrdreJour(
      req.params.id as string,
      req.body as GererOrdreJourInput,
    );
    res.status(200).json({ success: true, data });
  }

  async modifierPoint(req: Request, res: Response): Promise<void> {
    await this.assurerPeutEditerReunion(req, req.params.id as string);
    const data = await reunionService.modifierPoint(
      req.params.id as string,
      req.params.pointId as string,
      (req.body as { est_traite: boolean }).est_traite,
    );
    res.status(200).json({ success: true, data });
  }

  async modifierParticipant(req: Request, res: Response): Promise<void> {
    await this.assurerPeutEditerReunion(req, req.params.id as string);
    const data = await reunionService.modifierParticipant(
      req.params.id as string,
      req.params.participantId as string,
      (req.body as { statut: string }).statut,
    );
    res.status(200).json({ success: true, data });
  }

  async repondreInvitation(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const { reponse } = req.body as RepondreInvitationInput;
    const data = await reunionService.repondreInvitation(
      req.params.id as string,
      req.user.id,
      reponse,
    );
    res.status(200).json({ success: true, data });
  }

  /**
   * Ayant-droit : toutes les réunions.
   * Agent : uniquement ses propres réunions (création / proposition).
   */
  private async assurerPeutEditerReunion(req: Request, reunionId: string): Promise<void> {
    if (utilisateurPeutApprouver(req.user)) return;
    if (!req.user) {
      throw new AppError(401, 'Authentification requise.');
    }
    const reunion = await reunionService.obtenirParId(reunionId);
    if (reunion.cree_par !== req.user.id) {
      throw new AppError(
        403,
        'Vous ne pouvez modifier que les réunions que vous avez créées. Les autres sont en lecture seule.',
      );
    }
  }
}

export const reunionController = new ReunionController();
