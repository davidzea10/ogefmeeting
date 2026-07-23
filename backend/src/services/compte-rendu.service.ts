import type {
  CommentaireCompteRendu,
  CompteRendu,
  PaginatedResult,
  VersionCompteRendu,
} from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type {
  CreerCommentaireCrInput,
  CreerCompteRenduInput,
  ListerComptesRendusQuery,
  ModifierCompteRenduInput,
  RejeterCompteRenduInput,
  SoumettreCompteRenduInput,
  ValiderCompteRenduInput,
} from '../schemas/compte-rendu.schemas.js';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { genererPdfCompteRendu, nomFichierPdfCr } from './cr-pdf.service.js';
import { notifierChangementStatutCr } from './cr-notification.service.js';
import { parametresService } from './parametres.service.js';

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

  async lister(
    query: ListerComptesRendusQuery,
    options: { limiterAuProfilId?: string | null } = {},
  ): Promise<PaginatedResult<CompteRendu>> {
    const supabase = requireSupabaseAdmin();
    const { page, limite, tri, ordre, statut, reunion_id } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    let idsReunions: string[] | null = null;
    if (options.limiterAuProfilId) {
      const { data: liens, error: liensError } = await supabase
        .from(TABLES.participantsReunion)
        .select('reunion_id')
        .eq('profil_id', options.limiterAuProfilId);
      if (liensError) {
        handleSupabaseError(liensError, 'Impossible de charger vos réunions.');
      }
      idsReunions = (liens ?? []).map((l) => l.reunion_id as string);
      if (idsReunions.length === 0) {
        return {
          items: [],
          pagination: { page, limite, total: 0, total_pages: 1 },
        };
      }
    }

    let builder = supabase
      .from(TABLES.comptesRendus)
      .select('*', { count: 'exact' });

    if (statut) {
      builder = builder.eq('statut', statut);
    } else {
      builder = builder.neq('statut', 'archive');
    }

    if (reunion_id) builder = builder.eq('reunion_id', reunion_id);
    if (idsReunions) builder = builder.in('reunion_id', idsReunions);

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

  async obtenirParId(
    id: string,
    options: { limiterAuProfilId?: string | null } = {},
  ): Promise<CompteRendu> {
    const cr = await this.assurerExiste(id);
    if (options.limiterAuProfilId) {
      const { data, error } = await requireSupabaseAdmin()
        .from(TABLES.participantsReunion)
        .select('id')
        .eq('reunion_id', cr.reunion_id)
        .eq('profil_id', options.limiterAuProfilId)
        .maybeSingle();
      if (error) {
        handleSupabaseError(error, 'Impossible de vérifier l’accès au compte rendu.');
      }
      if (!data) {
        throw new AppError(
          403,
          'Vous ne pouvez consulter que les comptes rendus des réunions auxquelles vous êtes invité.',
        );
      }
    }
    return cr;
  }

  async modifier(id: string, input: ModifierCompteRenduInput): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut === 'valide' || actuel.statut === 'archive') {
      throw new AppError(400, 'Un compte rendu validé ou archivé ne peut plus être modifié.');
    }

    if (actuel.statut === 'soumis') {
      throw new AppError(
        400,
        'Un compte rendu soumis est en attente de validation et ne peut plus être modifié.',
      );
    }

    const supabase = requireSupabaseAdmin();
    const historiser = Boolean(input.historiser);
    const nouvelleVersion = historiser ? actuel.version + 1 : actuel.version;

    if (historiser) {
      const { error: versionError } = await supabase.from(TABLES.versionsCompteRendu).insert({
        compte_rendu_id: id,
        version: actuel.version,
        contenu: actuel.contenu,
        modifie_par: input.modifie_par ?? null,
      });

      if (versionError) {
        handleSupabaseError(versionError, 'Impossible d’enregistrer la version précédente.');
      }
    }

    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .update({
        contenu: input.contenu ?? actuel.contenu,
        contenu_html:
          input.contenu_html !== undefined ? input.contenu_html : actuel.contenu_html,
        version: nouvelleVersion,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier le compte rendu.');
    }

    return data as CompteRendu;
  }

  async soumettre(id: string, input: SoumettreCompteRenduInput = {}): Promise<CompteRendu> {
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

    const cr = data as CompteRendu;

    if (input.commentaire?.trim()) {
      await this.insererCommentaire(id, {
        contenu: input.commentaire.trim(),
        type: 'soumission',
        auteur_id: input.auteur_id ?? null,
      });
    }

    await notifierChangementStatutCr({
      cr,
      ancienStatut: actuel.statut,
      nouveauStatut: 'soumis',
      commentaire: input.commentaire,
    });

    return cr;
  }

  async valider(id: string, input: ValiderCompteRenduInput): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut !== 'soumis') {
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

    const cr = data as CompteRendu;

    if (input.commentaire?.trim()) {
      await this.insererCommentaire(id, {
        contenu: input.commentaire.trim(),
        type: 'validation',
        auteur_id: input.valide_par ?? null,
      });
    }

    await notifierChangementStatutCr({
      cr,
      ancienStatut: actuel.statut,
      nouveauStatut: 'valide',
      commentaire: input.commentaire,
    });

    return cr;
  }

  async rejeter(id: string, input: RejeterCompteRenduInput): Promise<CompteRendu> {
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

    const cr = data as CompteRendu;

    await this.insererCommentaire(id, {
      contenu: input.commentaire.trim(),
      type: 'rejet',
      auteur_id: input.auteur_id ?? null,
    });

    await notifierChangementStatutCr({
      cr,
      ancienStatut: actuel.statut,
      nouveauStatut: 'en_revision',
      commentaire: input.commentaire,
    });

    return cr;
  }

  async archiver(id: string): Promise<CompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut !== 'valide') {
      throw new AppError(400, 'Seuls les comptes rendus validés peuvent être archivés.');
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.comptesRendus)
      .update({ statut: 'archive' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’archiver le compte rendu.');
    }

    const cr = data as CompteRendu;
    await notifierChangementStatutCr({
      cr,
      ancienStatut: actuel.statut,
      nouveauStatut: 'archive',
    });

    return cr;
  }

  async listerCommentaires(id: string): Promise<CommentaireCompteRendu[]> {
    await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.commentairesCompteRendu)
      .select('*')
      .eq('compte_rendu_id', id)
      .order('cree_le', { ascending: true });

    if (error) {
      handleSupabaseError(error, 'Impossible de charger les commentaires.');
    }

    const items = (data ?? []) as CommentaireCompteRendu[];
    const auteurIds = [...new Set(items.map((c) => c.auteur_id).filter(Boolean))] as string[];

    if (auteurIds.length === 0) return items;

    const { data: profils } = await supabase
      .from(TABLES.profils)
      .select('id, prenom, nom')
      .in('id', auteurIds);

    const noms = new Map(
      ((profils ?? []) as { id: string; prenom: string; nom: string }[]).map((p) => [
        p.id,
        `${p.prenom} ${p.nom}`,
      ]),
    );

    return items.map((c) => ({
      ...c,
      auteur_nom: c.auteur_id ? (noms.get(c.auteur_id) ?? null) : null,
    }));
  }

  async ajouterCommentaire(
    id: string,
    input: CreerCommentaireCrInput,
  ): Promise<CommentaireCompteRendu> {
    const actuel = await this.assurerExiste(id);

    if (actuel.statut === 'archive') {
      throw new AppError(400, 'Impossible de commenter un compte rendu archivé.');
    }

    return this.insererCommentaire(id, {
      contenu: input.contenu.trim(),
      type: input.type ?? 'note',
      auteur_id: input.auteur_id ?? null,
    });
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
   * Export HTML (métadonnées JSON).
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
      message: 'Utilisez /export/pdf pour télécharger le PDF binaire.',
    };
  }

  /**
   * Génère le PDF binaire du compte rendu.
   */
  async exporterPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const compte_rendu = await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { data: reunion, error: reunionError } = await supabase
      .from(TABLES.reunions)
      .select('titre, date_prevue, lieu, type_reunion, description, modele_id')
      .eq('id', compte_rendu.reunion_id)
      .single();

    if (reunionError || !reunion) {
      handleSupabaseError(reunionError, 'Réunion associée introuvable.');
    }

    let sections: import('@ogefmeeting/shared').SectionCompteRendu[] | null = null;
    const modeleId = (reunion as { modele_id?: string | null }).modele_id;
    if (modeleId) {
      const { data: modele } = await supabase
        .from(TABLES.modelesCompteRendu)
        .select('sections')
        .eq('id', modeleId)
        .maybeSingle();
      const secs = (modele as { sections?: import('@ogefmeeting/shared').SectionCompteRendu[] } | null)
        ?.sections;
      if (secs?.length) sections = secs;
    }

    let valideParNom: string | null = null;
    if (compte_rendu.valide_par) {
      const { data: profil } = await supabase
        .from(TABLES.profils)
        .select('prenom, nom')
        .eq('id', compte_rendu.valide_par)
        .maybeSingle();
      if (profil) {
        valideParNom = `${(profil as { prenom: string }).prenom} ${(profil as { nom: string }).nom}`;
      }
    }

    const parametres = await parametresService.obtenir();

    const buffer = await genererPdfCompteRendu({
      compteRendu: compte_rendu,
      reunion: reunion as Pick<
        import('@ogefmeeting/shared').Reunion,
        'titre' | 'date_prevue' | 'lieu' | 'type_reunion' | 'description'
      >,
      sections,
      valideParNom,
      enTetePdf: parametres.en_tete_pdf,
      sousTitrePdf: parametres.sous_titre_pdf,
    });

    // Mémorise qu’un export PDF a été généré (chemin logique, pas de stockage fichier V1)
    await supabase
      .from(TABLES.comptesRendus)
      .update({ chemin_pdf: `generated://${id}/${Date.now()}.pdf` })
      .eq('id', id);

    const filename = nomFichierPdfCr(
      (reunion as { titre: string }).titre,
      compte_rendu.version,
    );

    return { buffer, filename };
  }

  private async insererCommentaire(
    compteRenduId: string,
    input: { contenu: string; type: string; auteur_id: string | null },
  ): Promise<CommentaireCompteRendu> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.commentairesCompteRendu)
      .insert({
        compte_rendu_id: compteRenduId,
        contenu: input.contenu,
        type: input.type,
        auteur_id: input.auteur_id,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’enregistrer le commentaire.');
    }

    return data as CommentaireCompteRendu;
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
