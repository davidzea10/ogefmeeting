import type { Request, Response } from 'express';
import type {
  CreerDirectionInput,
  CreerModeleInput,
  ListerProfilsQuery,
  ModifierDirectionInput,
  ModifierModeleInput,
  ModifierProfilInput,
  RechercheQuery,
} from '../schemas/admin.schemas.js';
import {
  directionService,
  modeleCompteRenduService,
  profilService,
  rechercheService,
} from '../services/admin.service.js';
import { profilLimiteAuxParticipations } from '../utils/reunion-acces.js';

export class DirectionController {
  async lister(_req: Request, res: Response): Promise<void> {
    const data = await directionService.lister();
    res.status(200).json({ success: true, data });
  }

  async creer(req: Request, res: Response): Promise<void> {
    const data = await directionService.creer(req.body as CreerDirectionInput);
    res.status(201).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await directionService.modifier(
      req.params.id as string,
      req.body as ModifierDirectionInput,
    );
    res.status(200).json({ success: true, data });
  }
}

export class ProfilController {
  async lister(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerProfilsQuery;
    const data = await profilService.lister(query);
    res.status(200).json({ success: true, data });
  }

  async obtenirParId(req: Request, res: Response): Promise<void> {
    const data = await profilService.obtenirParId(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await profilService.modifier(
      req.params.id as string,
      req.body as ModifierProfilInput,
    );
    res.status(200).json({ success: true, data });
  }
}

export class ModeleController {
  async lister(_req: Request, res: Response): Promise<void> {
    const data = await modeleCompteRenduService.lister();
    res.status(200).json({ success: true, data });
  }

  async creer(req: Request, res: Response): Promise<void> {
    const data = await modeleCompteRenduService.creer(req.body as CreerModeleInput);
    res.status(201).json({ success: true, data });
  }

  async modifier(req: Request, res: Response): Promise<void> {
    const data = await modeleCompteRenduService.modifier(
      req.params.id as string,
      req.body as ModifierModeleInput,
    );
    res.status(200).json({ success: true, data });
  }
}

export class RechercheController {
  async rechercher(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as RechercheQuery;
    const data = await rechercheService.rechercher(query, {
      limiterReunionsAuProfilId: profilLimiteAuxParticipations(req.user),
    });
    res.status(200).json({ success: true, data });
  }
}

export const directionController = new DirectionController();
export const profilController = new ProfilController();
export const modeleController = new ModeleController();
export const rechercheController = new RechercheController();
