import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { enregistrerAudit } from './audit.service.js';

export type ReunionNettoyageItem = {
  id: string;
  titre: string;
  statut: string;
  date_prevue: string;
  cree_le: string;
  est_test_live: boolean;
};

export class NettoyageService {
  async compterNotifications(): Promise<number> {
    const supabase = requireSupabaseAdmin();
    const { count, error } = await supabase
      .from(TABLES.notifications)
      .select('*', { count: 'exact', head: true });

    if (error) {
      handleSupabaseError(error, 'Impossible de compter les notifications.');
    }
    return count ?? 0;
  }

  async purgerToutesNotifications(modifiePar?: string): Promise<{ supprimees: number }> {
    const supabase = requireSupabaseAdmin();
    const total = await this.compterNotifications();

    const { error } = await supabase
      .from(TABLES.notifications)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      handleSupabaseError(error, 'Impossible de supprimer les notifications.');
    }

    await enregistrerAudit({
      action: 'admin.purge_notifications',
      profil_id: modifiePar ?? null,
      type_entite: 'notification',
      entite_id: null,
      metadonnees: { supprimees: total },
    });

    return { supprimees: total };
  }

  async listerReunionsPourNettoyage(): Promise<ReunionNettoyageItem[]> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .select('id, titre, statut, date_prevue, cree_le')
      .order('cree_le', { ascending: false })
      .limit(100);

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les réunions.');
    }

    return (data ?? []).map((r) => ({
      id: r.id as string,
      titre: r.titre as string,
      statut: r.statut as string,
      date_prevue: r.date_prevue as string,
      cree_le: r.cree_le as string,
      est_test_live: String(r.titre ?? '')
        .trim()
        .toUpperCase()
        .startsWith('[TEST LIVE]'),
    }));
  }

  /**
   * Suppression définitive d’une réunion (médias + enfants + notifs liées).
   * Réservé admin — pour nettoyer les tests avant mise en prod.
   */
  async supprimerReunionDefinitive(
    id: string,
    modifiePar?: string,
  ): Promise<{ id: string; titre: string }> {
    const supabase = requireSupabaseAdmin();

    const { data: reunion, error: findError } = await supabase
      .from(TABLES.reunions)
      .select('id, titre, statut')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      handleSupabaseError(findError, 'Impossible de trouver la réunion.');
    }
    if (!reunion) {
      throw new AppError(404, 'Réunion introuvable.');
    }

    if (reunion.statut === 'en_cours' || reunion.statut === 'en_pause') {
      throw new AppError(
        400,
        'Clôturez ou annulez le live avant de supprimer définitivement cette réunion.',
      );
    }

    const { data: audios } = await supabase
      .from(TABLES.enregistrements)
      .select('chemin_stockage')
      .eq('reunion_id', id);

    const chemins = (audios ?? [])
      .map((a) => a.chemin_stockage as string)
      .filter(Boolean);
    if (chemins.length > 0) {
      await supabase.storage.from('recordings').remove(chemins);
    }

    await supabase.from(TABLES.enregistrements).delete().eq('reunion_id', id);
    await supabase.from(TABLES.transcriptions).delete().eq('reunion_id', id);

    // Notifications liées (métadonnées JSON)
    const { data: notifs } = await supabase
      .from(TABLES.notifications)
      .select('id, metadonnees')
      .limit(5000);

    const notifIds = (notifs ?? [])
      .filter((n) => {
        const meta = (n.metadonnees ?? {}) as Record<string, unknown>;
        return meta.reunion_id === id;
      })
      .map((n) => n.id as string);

    if (notifIds.length > 0) {
      await supabase.from(TABLES.notifications).delete().in('id', notifIds);
    }

    const { error: deleteError } = await supabase
      .from(TABLES.reunions)
      .delete()
      .eq('id', id);

    if (deleteError) {
      handleSupabaseError(deleteError, 'Impossible de supprimer la réunion.');
    }

    await enregistrerAudit({
      action: 'admin.supprimer_reunion',
      profil_id: modifiePar ?? null,
      type_entite: 'reunion',
      entite_id: id,
      metadonnees: { titre: reunion.titre },
    });

    return { id, titre: reunion.titre as string };
  }

  async supprimerReunionsTestLive(modifiePar?: string): Promise<{
    supprimees: number;
    titres: string[];
  }> {
    const items = await this.listerReunionsPourNettoyage();
    const tests = items.filter((r) => r.est_test_live);
    const titres: string[] = [];

    for (const r of tests) {
      if (r.statut === 'en_cours' || r.statut === 'en_pause') continue;
      const result = await this.supprimerReunionDefinitive(r.id, modifiePar);
      titres.push(result.titre);
    }

    return { supprimees: titres.length, titres };
  }
}

export const nettoyageService = new NettoyageService();
