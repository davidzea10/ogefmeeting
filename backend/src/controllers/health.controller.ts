import type { Request, Response } from 'express';
import { APP_VERSION } from '@ogefmeeting/shared';
import { corsOrigins, env } from '../config/env.js';
import {
  isSupabaseAuthConfigured,
  isSupabaseConfigured,
} from '../lib/supabase.js';
import { healthService } from '../services/health.service.js';

/** Marqueur de déploiement — pour vérifier que Render a bien la dernière version */
export const BUILD_MARKER = '2026-07-23-dashboard-notifs';

/**
 * Contrôleur Health — reçoit la requête HTTP, appelle le service, renvoie la réponse.
 * Pas de logique métier ici (MVC : couche Controller).
 */
export class HealthController {
  /** Ping minimal (aucune dépendance externe) */
  async ping(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        ok: true,
        build: BUILD_MARKER,
        version: APP_VERSION,
        node_env: env.NODE_ENV,
        cors_origins: corsOrigins,
        supabase_url_configured: isSupabaseConfigured(),
        supabase_anon_configured: isSupabaseAuthConfigured(),
        supabase_url_host: env.SUPABASE_URL
          ? new URL(env.SUPABASE_URL).host
          : null,
      },
    });
  }

  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const data = await healthService.getStatus();
      res.status(200).json({
        success: true,
        data: {
          ...data,
          build: BUILD_MARKER,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      res.status(500).json({
        success: false,
        error: {
          message,
          build: BUILD_MARKER,
          stack: env.NODE_ENV === 'production' ? undefined : stack,
        },
      });
    }
  }
}

export const healthController = new HealthController();
