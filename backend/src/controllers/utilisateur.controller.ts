import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import type {
  InviterUtilisateurInput,
  ListerAuditQuery,
  ModifierMonProfilInput,
  ModifierMotDePasseInput,
  MotDePasseOublieInput,
} from '../schemas/utilisateur.schemas.js';
import type { ModifierProfilInput } from '../schemas/admin.schemas.js';
import { authService } from '../services/auth.service.js';
import { utilisateurService } from '../services/utilisateur.service.js';
import { permissionsPourRole } from '../utils/permissions.js';
import { AppError } from '../utils/errors.js';

export class UtilisateurController {
  async obtenirMonProfil(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      if (!env.AUTH_ENFORCED) {
        res.status(200).json({
          success: true,
          data: {
            authentifie: false,
            auth_enforced: false,
            message: 'Connectez-vous pour consulter votre profil.',
          },
        });
        return;
      }
      throw new AppError(401, 'Authentification requise.');
    }

    const profil = await authService.moi(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        authentifie: true,
        profil,
        permissions: permissionsPourRole(req.user.role, req.user.fonction),
      },
    });
  }

  async modifierMonProfil(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError(401, 'Authentification requise.');
    }

    const data = await utilisateurService.modifierMonProfil(
      req.user.id,
      req.body as ModifierMonProfilInput,
    );
    res.status(200).json({ success: true, data });
  }

  async inviter(req: Request, res: Response): Promise<void> {
    const data = await utilisateurService.inviter(
      req.body as InviterUtilisateurInput,
      req.user?.id,
    );
    res.status(201).json({ success: true, data });
  }

  async modifierProfilAdmin(req: Request, res: Response): Promise<void> {
    const data = await utilisateurService.modifierProfilAdmin(
      req.params.id as string,
      req.body as ModifierProfilInput,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }

  async desactiverProfil(req: Request, res: Response): Promise<void> {
    const data = await utilisateurService.desactiverProfil(
      req.params.id as string,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }

  async reactiverProfil(req: Request, res: Response): Promise<void> {
    const data = await utilisateurService.reactiverProfil(
      req.params.id as string,
      req.user?.id,
    );
    res.status(200).json({ success: true, data });
  }

  async changerMotDePasse(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError(401, 'Authentification requise.');
    }

    await utilisateurService.changerMotDePasse(
      req.user.id,
      req.body as ModifierMotDePasseInput,
    );
    res.status(200).json({
      success: true,
      data: { message: 'Mot de passe mis à jour.' },
    });
  }

  async motDePasseOublie(req: Request, res: Response): Promise<void> {
    const data = await utilisateurService.motDePasseOublie(
      req.body as MotDePasseOublieInput,
    );
    res.status(200).json({ success: true, data });
  }

  async listerJournaux(req: Request, res: Response): Promise<void> {
    const query = (req.validated?.query ?? req.query) as ListerAuditQuery;
    const data = await utilisateurService.listerJournaux(query);
    res.status(200).json({ success: true, data });
  }
}

export const utilisateurController = new UtilisateurController();
