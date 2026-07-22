import type {
  CompteRendu,
  PaginatedResult,
  VersionCompteRendu,
} from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type {
  CreerCompteRenduInput,
  ListerComptesRendusQuery,
  ModifierCompteRenduInput,
  ValiderCompteRenduInput,
} from '../schemas/compte-rendu.schemas.js';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';

export class CompteRenduService {
  async creer(input: CreerCompteRenduInput): Promise<CompteRendu> {
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .insert({
        reunion_id: input.reunion_id,
        contenu: input.contenu,
        contenu_html: input.contenu_html ?? null,
        cree_par: input.cree_par ?? null,
        statut: 'brouillon',
        version: 1,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer le compte rendu.');
    }

    return data as CompteRendu;
  }

  async lister(query: ListerComptesRendusQuery): Promise<PaginatedResult<CompteRendu>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, tri, ordre, statut, reunion_id } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let builder = supabase
      .from(TABLES.comptesRendus)
      .select('*', { count: 'exact' })
      .neq('statut', 'archive');

    if (statut) builder = builder.eq('statut', statut);
    if (reunion_id) builder = builder.eq('reunion_id', reunion_id);

    const { data, error, count } = await builder
      .order(tri, { ascending: ordre === 'asc' })
      .range(from, to);

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les comptes rendus.');
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as CompteRendu[],
      pagination: {
        page,
        limite,
        total,
        total_pages: Math.max(1, Math.ceil(total / limite)),
      },
    };
  }

  async obtenirParId(id: string): Promise<CompteRendu> {
    return this.assurerExiste(id);
  }

  async modifier(id: string, input: ModifierCompteRenduInput): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut === 'valide' || actuel.statut === 'archive') {
      throw new AppError(400, 'Un compte rendu validé ou archivé ne peut plus être modifié.');
    }

    const supabase = requireSupabaseAdmin();
    const nouvelleVersion = actuel.version + 1;

    // Historiser la version précédente
    const { error: versionError } = await supabase.from(TABLES.versionsCompteRendu).insert({
      compte_rendu_id: id,
      version: actuel.version,
      contenu: actuel.contenu,
      modifie_par: input.modifie_par ?? null,
    });

    if (versionError) {
      handleSupabaseError(versionError, 'Impossible d’enregistrer la version précédente.');
    }

    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .update({
        contenu: input.contenu ?? actuel.contenu,
        contenu_html:
          input.contenu_html !== undefined ? input.contenu_html : actuel.contenu_html,
        version: nouvelleVersion,
        statut: actuel.statut === 'soumis' || actuel.statut === 'en_revision' ? 'brouillon' : actuel.statut,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier le compte rendu.');
    }

    return data as CompteRendu;
  }

  async soumettre(id: string): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut !== 'brouillon' && actuel.statut !== 'en_revision') {
      throw new AppError(
        400,
        `Impossible de soumettre un compte rendu au statut « ${actuel.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .update({
        statut: 'soumis',
        soumis_le: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de soumettre le compte rendu.');
    }

    return data as CompteRendu;
  }

  async valider(id: string, input: ValiderCompteRenduInput): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut !== 'soumis' && actuel.statut !== 'en_revision') {
      throw new AppError(
        400,
        `Impossible de valider un compte rendu au statut « ${actuel.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .update({
        statut: 'valide',
        valide_le: new Date().toISOString(),
        valide_par: input.valide_par ?? null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de valider le compte rendu.');
    }

    return data as CompteRendu;
  }

  async rejeter(id: string): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut !== 'soumis') {
      throw new AppError(400, 'Seuls les comptes rendus soumis peuvent être renvoyés en révision.');
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .update({ statut: 'en_revision' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de renvoyer le compte rendu en révision.');
    }

    return data as CompteRendu;
  }

  async listerVersions(id: string): Promise<VersionCompteRendu[]> {
    await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.versionsCompteRendu)
      .select('*')
      .eq('compte_rendu_id', id)
      .order('version', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'Impossible de charger l’historique des versions.');
    }

    return (data ?? []) as VersionCompteRendu[];
  }

  /**
   * Export HTML (PDF binaire prévu à l'étape 8).
   */
  async exporter(id: string): Promise<{
    format: 'html';
    compte_rendu: CompteRendu;
    message: string;
  }> {
    const compte_rendu = await this.assurerExiste(id);

    return {
      format: 'html',
      compte_rendu,
      message:
        'Export HTML disponible. La génération PDF binaire sera ajoutée à l’étape 8.',
    };
  }

  private async assurerExiste(id: string): Promise<CompteRendu> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'Compte rendu introuvable.');
    }

    return data as CompteRendu;
  }
}

export const compteRenduService = new CompteRenduService();
