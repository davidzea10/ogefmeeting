import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import type {
  ConnexionInput,
  InscriptionInput,
  RafraichirInput,
} from '../schemas/auth.schemas.js';
import { authService } from '../services/auth.service.js';
import { enregistrerAudit } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';

export class AuthController {
  async inscription(req: Request, res: Response): Promise<void> {
    const data = await authService.inscription(req.body as InscriptionInput);
    await enregistrerAudit({
      action: 'auth.inscription',
      profil_id: data.user.id,
      type_entite: 'profil',
      entite_id: data.user.id,
      metadonnees: { email: data.user.email },
      req,
    });
    res.status(201).json({
      success: true,
      data: {
        ...data,
        auth_enforced: env.AUTH_ENFORCED,
        message: data.access_token
          ? 'Compte créé et session ouverte.'
          : 'Compte créé. Confirmez votre email si la confirmation est activée dans Supabase, puis connectez-vous.',
      },
    });
  }

  async connexion(req: Request, res: Response): Promise<void> {
    const data = await authService.connexion(req.body as ConnexionInput);
    await enregistrerAudit({
      action: 'auth.connexion',
      profil_id: data.user.id,
      type_entite: 'profil',
      entite_id: data.user.id,
      metadonnees: { email: data.user.email },
      req,
    });
    res.status(200).json({
      success: true,
      data: {
        ...data,
        auth_enforced: env.AUTH_ENFORCED,
      },
    });
  }

  async rafraichir(req: Request, res: Response): Promise<void> {
    const data = await authService.rafraichir(req.body as RafraichirInput);
    res.status(200).json({ success: true, data });
  }

  async moi(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      // Mode souple : pas de 401 forcé si AUTH_ENFORCED=false
      if (!env.AUTH_ENFORCED) {
        res.status(200).json({
          success: true,
          data: {
            authentifie: false,
            auth_enforced: false,
            message: 'Aucun JWT fourni. L’API reste utilisable sans connexion.',
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
        auth_enforced: env.AUTH_ENFORCED,
        user: req.user,
        profil,
      },
    });
  }

  async deconnexion(req: Request, res: Response): Promise<void> {
    await authService.deconnexion(req.accessToken);
    if (req.user) {
      await enregistrerAudit({
        action: 'auth.deconnexion',
        profil_id: req.user.id,
        type_entite: 'profil',
        entite_id: req.user.id,
        req,
      });
    }
    res.status(200).json({
      success: true,
      data: { deconnecte: true },
    });
  }
}

export const authController = new AuthController();
