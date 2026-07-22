import type { HealthStatus } from '@ogefmeeting/shared';
import { APP_NAME, APP_VERSION, TABLES } from '@ogefmeeting/shared';
import { env } from '../config/env.js';
import {
  getSupabaseAdmin,
  isSupabaseAuthConfigured,
  isSupabaseConfigured,
} from '../lib/supabase.js';

/**
 * Service Health — logique métier / accès données.
 */
export class HealthService {
  async getStatus(): Promise<HealthStatus> {
    let supabaseStatus: HealthStatus['supabase'] = 'not_configured';
    let database: HealthStatus['database'];

    if (isSupabaseConfigured()) {
      supabaseStatus = 'configured';
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const [directionsResult, templatesResult] = await Promise.all([
          supabase.from(TABLES.directions).select('id', { count: 'exact', head: true }),
          supabase.from(TABLES.modelesCompteRendu).select('id', { count: 'exact', head: true }),
        ]);

        if (directionsResult.error || templatesResult.error) {
          supabaseStatus = 'error';
        } else {
          supabaseStatus = 'connected';
          database = {
            directions: directionsResult.count ?? 0,
            templates: templatesResult.count ?? 0,
          };
        }
      }
    }

    return {
      app: APP_NAME,
      version: APP_VERSION,
      environment: env.NODE_ENV,
      status: supabaseStatus === 'error' ? 'degraded' : 'ok',
      supabase: supabaseStatus,
      database,
      auth: {
        enforced: env.AUTH_ENFORCED,
        anon_configured: isSupabaseAuthConfigured(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
