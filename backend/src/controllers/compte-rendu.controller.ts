import type { Request, Response } from 'express';
import type {
  CreerCommentaireCrInput,
  CreerCompteRenduInput,
  GenererCrIaInput,
  ListerComptesRendusQuery,
  ModifierCompteRenduInput,
  RejeterCompteRenduInput,
  SoumettreCompteRenduInput,
  ValiderCompteRenduInput,
} from '../schemas/compte-rendu.schemas.js';
import { compteRenduService } from '../services/compte-rendu.service.js';
import { reunionService } from '../services/reunion.service.js';
import { AppError } from '../utils/errors.js';
import {
  profilLimiteAuxParticipations,
  utilisateurPeutRedigerCompteRendu,
} from '../utils/reunion-acces.js';
import { PERMISSIONS, roleAutorise } from '../utils/permissions.js';

export class CompteRenduController {
  async creer(req: Request, res: Response): Promise<void> {
    const body = req.body as CreerCompteRenduInput;
    await this.assurerPeutRedigerReunion(req, body.reunion_id);
    const data = await compteRenduService.creer(body);
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
    await this.assurerPeutRedigerCr(req, req.params.id as string);
    const ajustementDirecteur = Boolean(
      req.user && roleAutorise(req.user.role, PERMISSIONS.CR_VALIDER),
    );
    const data = await compteRenduService.modifier(
      req.params.id as string,
      req.body as ModifierCompteRenduInput,
      { ajustementDirecteur },
    );
    res.status(200).json({ success: true, data });
  }

  async soumettre(req: Request, res: Response): Promise<void> {
    await this.assurerPeutRedigerCr(req, req.params.id as string);
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
    await compteRenduService.obtenirParId(req.params.id as string, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    const { buffer, filename } = await compteRenduService.exporterPdf(
      req.params.id as string,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).send(buffer);
  }

  async genererAvecIa(req: Request, res: Response): Promise<void> {
    await this.assurerPeutRedigerCr(req, req.params.id as string);
    await compteRenduService.obtenirParId(req.params.id as string, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    const body = (req.body ?? {}) as GenererCrIaInput;
    const data = await compteRenduService.genererAvecIa(req.params.id as string, {
      modifie_par: req.user?.id ?? null,
      niveau_detail: body.niveau_detail,
    });
    res.status(200).json({ success: true, data });
  }

  async envoyerAuxParticipants(req: Request, res: Response): Promise<void> {
    const cr = await compteRenduService.obtenirParId(req.params.id as string, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });

    const reunion = await reunionService.obtenirParId(cr.reunion_id);
    if (!utilisateurPeutRedigerCompteRendu(req.user, reunion)) {
      throw new AppError(
        403,
        'Seul l’organisateur, le secrétariat, un directeur ou un administrateur peut envoyer le rapport.',
      );
    }

    const data = await compteRenduService.envoyerAuxParticipants(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  private async assurerPeutRedigerReunion(req: Request, reunionId: string): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const reunion = await reunionService.obtenirParId(reunionId);
    if (!utilisateurPeutRedigerCompteRendu(req.user, reunion)) {
      throw new AppError(
        403,
        'Seul l’organisateur de la réunion, le secrétariat ou un ayant-droit peut créer ou modifier le compte rendu.',
      );
    }
  }

  private async assurerPeutRedigerCr(req: Request, crId: string): Promise<void> {
    const cr = await compteRenduService.obtenirParId(crId, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    await this.assurerPeutRedigerReunion(req, cr.reunion_id);
  }
}

export const compteRenduController = new CompteRenduController();
