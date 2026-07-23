import type {
  PaginatedResult,
  ParticipantReunion,
  PointOrdreJour,
  Reunion,
  ReunionDetail,
} from '@ogefmeeting/shared';
import { TABLES } from '@ogefmeeting/shared';
import { requireSupabaseAdmin } from '../lib/supabase.js';
import type {
  CreerReunionInput,
  GererOrdreJourInput,
  GererParticipantsInput,
  ListerReunionsQuery,
  ModifierReunionInput,
} from '../schemas/reunion.schemas.js';
import { AppError } from '../utils/errors.js';
import { handleSupabaseError } from '../utils/supabase-error.js';
import { notificationService } from './notification.service.js';

export type ScopeReunion = {
  /** Si défini : ne renvoyer que les réunions où ce profil est participant */
  limiterAuProfilId?: string | null;
};

export class ReunionService {
  async idsReunionsVisiblesPourMembre(profilId: string): Promise<string[]> {
    const supabase = requireSupabaseAdmin();
    const [participations, creees] = await Promise.all([
      supabase
        .from(TABLES.participantsReunion)
        .select('reunion_id')
        .eq('profil_id', profilId),
      supabase.from(TABLES.reunions).select('id').eq('cree_par', profilId),
    ]);

    if (participations.error) {
      handleSupabaseError(participations.error, 'Impossible de charger vos réunions.');
    }
    if (creees.error) {
      handleSupabaseError(creees.error, 'Impossible de charger vos propositions.');
    }

    const ids = new Set<string>();
    for (const l of participations.data ?? []) {
      ids.add(l.reunion_id as string);
    }
    for (const r of creees.data ?? []) {
      ids.add(r.id as string);
    }
    return [...ids];
  }

  async idsReunionsDuParticipant(profilId: string): Promise<string[]> {
    return this.idsReunionsVisiblesPourMembre(profilId);
  }

  async estParticipant(reunionId: string, profilId: string): Promise<boolean> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.participantsReunion)
      .select('id')
      .eq('reunion_id', reunionId)
      .eq('profil_id', profilId)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'Impossible de vérifier la participation.');
    }

    return Boolean(data);
  }

  async peutVoirReunion(reunionId: string, profilId: string): Promise<boolean> {
    if (await this.estParticipant(reunionId, profilId)) return true;

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .select('id')
      .eq('id', reunionId)
      .eq('cree_par', profilId)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'Impossible de vérifier l’accès à la réunion.');
    }

    return Boolean(data);
  }

  async creer(
    input: CreerReunionInput,
    options: { directementPlanifiee?: boolean } = {},
  ): Promise<Reunion> {
    const supabase = requireSupabaseAdmin();
    const statut = options.directementPlanifiee
      ? 'planifiee'
      : 'en_attente_validation';

    const { data, error } = await supabase
      .from(TABLES.reunions)
      .insert({
        titre: input.titre,
        description: input.description ?? null,
        type_reunion: input.type_reunion,
        date_prevue: input.date_prevue,
        lieu: input.lieu ?? null,
        direction_id: input.direction_id ?? null,
        modele_id: input.modele_id ?? null,
        cree_par: input.cree_par ?? null,
        statut,
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer la réunion.');
    }

    const reunion = data as Reunion;

    // Le créateur est automatiquement participant
    if (input.cree_par) {
      await supabase.from(TABLES.participantsReunion).insert({
        reunion_id: reunion.id,
        profil_id: input.cree_par,
        statut: 'confirme',
      });
    }

    return reunion;
  }

  async lister(
    query: ListerReunionsQuery,
    scope: ScopeReunion = {},
  ): Promise<PaginatedResult<Reunion>> {
    const supabase = requireSupabaseAdmin();
    const {
      page,
      limite,
      tri,
      ordre,
      statut,
      type_reunion,
      direction_id,
      participant_id,
      date_apres,
      date_avant,
      recherche,
    } = query;
    const from = (page - 1) * limite;
    const to = from + limite - 1;

    /** Profil forcé (membre invité) prioritaire sur le filtre query */
    const profilScope = scope.limiterAuProfilId ?? participant_id ?? null;

    let idsParticipant: string[] | null = null;
    if (profilScope) {
      idsParticipant = await this.idsReunionsVisiblesPourMembre(profilScope);
      if (idsParticipant.length === 0) {
        return {
          items: [],
          pagination: { page, limite, total: 0, total_pages: 1 },
        };
      }
    }

    let builder = supabase.from(TABLES.reunions).select('*', { count: 'exact' });

    if (statut) {
      builder = builder.eq('statut', statut);
    } else {
      builder = builder.neq('statut', 'archivee');
    }

    if (type_reunion) {
      builder = builder.eq('type_reunion', type_reunion);
    }
    if (direction_id) {
      builder = builder.eq('direction_id', direction_id);
    }
    if (date_apres) {
      builder = builder.gte('date_prevue', date_apres);
    }
    if (date_avant) {
      builder = builder.lte('date_prevue', date_avant);
    }
    if (recherche) {
      builder = builder.ilike('titre', `%${recherche}%`);
    }
    if (idsParticipant) {
      builder = builder.in('id', idsParticipant);
    }

    builder = builder.order(tri, { ascending: ordre === 'asc' }).range(from, to);

    const { data, error, count } = await builder;

    if (error) {
      handleSupabaseError(error, 'Impossible de lister les réunions.');
    }

    const total = count ?? 0;

    return {
      items: (data ?? []) as Reunion[],
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
    scope: ScopeReunion = {},
  ): Promise<ReunionDetail> {
    const supabase = requireSupabaseAdmin();

    if (scope.limiterAuProfilId) {
      const ok = await this.peutVoirReunion(id, scope.limiterAuProfilId);
      if (!ok) {
        throw new AppError(
          403,
          'Vous ne pouvez consulter que les réunions auxquelles vous êtes invité ou que vous avez proposées.',
        );
      }
    }

    const { data: reunion, error } = await supabase
      .from(TABLES.reunions)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'Réunion introuvable.');
    }

    const [participantsResult, pointsResult] = await Promise.all([
      supabase.from(TABLES.participantsReunion).select('*').eq('reunion_id', id),
      supabase
        .from(TABLES.pointsOrdreJour)
        .select('*')
        .eq('reunion_id', id)
        .order('ordre', { ascending: true }),
    ]);

    if (participantsResult.error) {
      handleSupabaseError(participantsResult.error, 'Impossible de charger les participants.');
    }
    if (pointsResult.error) {
      handleSupabaseError(pointsResult.error, "Impossible de charger l'ordre du jour.");
    }

    return {
      ...(reunion as Reunion),
      participants: (participantsResult.data ?? []) as ParticipantReunion[],
      points_ordre_jour: (pointsResult.data ?? []) as PointOrdreJour[],
    };
  }

  async modifier(id: string, input: ModifierReunionInput): Promise<Reunion> {
    await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update(input)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier la réunion.');
    }

    return data as Reunion;
  }

  /** Soft delete : passe le statut à archivee */
  async archiver(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut === 'en_cours') {
      throw new AppError(400, 'Impossible d’archiver une réunion en cours. Clôturez-la d’abord.');
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({ statut: 'archivee' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’archiver la réunion.');
    }

    return data as Reunion;
  }

  async demarrer(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'planifiee') {
      throw new AppError(
        400,
        `Impossible de démarrer une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({
        statut: 'en_cours',
        date_debut: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de démarrer la réunion.');
    }

    return data as Reunion;
  }

  async cloturer(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'en_cours') {
      throw new AppError(
        400,
        `Impossible de clôturer une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({
        statut: 'cloturee',
        date_fin: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de clôturer la réunion.');
    }

    return data as Reunion;
  }

  /**
   * Remplace la liste des participants (supprime les anciens, insère les nouveaux).
   */
  async gererParticipants(
    id: string,
    input: GererParticipantsInput,
  ): Promise<ParticipantReunion[]> {
    const reunion = await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { error: deleteError } = await supabase
      .from(TABLES.participantsReunion)
      .delete()
      .eq('reunion_id', id);

    if (deleteError) {
      handleSupabaseError(deleteError, 'Impossible de mettre à jour les participants.');
    }

    if (input.participants.length === 0) {
      // Conserver au moins le créateur s’il existe
      if (reunion.cree_par) {
        const { data: alone, error: aloneError } = await supabase
          .from(TABLES.participantsReunion)
          .insert({
            reunion_id: id,
            profil_id: reunion.cree_par,
            statut: 'confirme',
          })
          .select('*');
        if (aloneError) {
          handleSupabaseError(aloneError, 'Impossible d’ajouter les participants.');
        }
        return (alone ?? []) as ParticipantReunion[];
      }
      return [];
    }

    const profilIds = new Set(input.participants.map((p) => p.profil_id));
    const rows = input.participants.map((p) => ({
      reunion_id: id,
      profil_id: p.profil_id,
      statut: p.statut,
    }));

    if (reunion.cree_par && !profilIds.has(reunion.cree_par)) {
      rows.push({
        reunion_id: id,
        profil_id: reunion.cree_par,
        statut: 'confirme',
      });
    }

    const { data, error } = await supabase
      .from(TABLES.participantsReunion)
      .insert(rows)
      .select('*');

    if (error) {
      handleSupabaseError(error, 'Impossible d’ajouter les participants.');
    }

    // Notifications d'invitation (in-app + email) — best-effort
    if (input.participants.length > 0) {
      const ids = input.participants.map((p) => p.profil_id);
      const { data: profils } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom')
        .in('id', ids);

      await notificationService.creerPourProfils(
        (profils ?? []) as { id: string; email: string; prenom: string; nom: string }[],
        {
          type: 'invitation_reunion',
          titre: 'Invitation à une réunion',
          message: `Vous êtes invité(e) à « ${reunion.titre} ».`,
          lien: `/reunions/${id}`,
          emailSujet: `[Ogefmeeting] Invitation — ${reunion.titre}`,
          metadonnees: { reunion_id: id },
        },
      );
    }

    return (data ?? []) as ParticipantReunion[];
  }

  /**
   * Remplace l'ordre du jour (supprime les anciens points, insère les nouveaux).
   */
  async gererOrdreJour(id: string, input: GererOrdreJourInput): Promise<PointOrdreJour[]> {
    await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { error: deleteError } = await supabase
      .from(TABLES.pointsOrdreJour)
      .delete()
      .eq('reunion_id', id);

    if (deleteError) {
      handleSupabaseError(deleteError, "Impossible de mettre à jour l'ordre du jour.");
    }

    if (input.points.length === 0) {
      return [];
    }

    const rows = input.points.map((point, index) => ({
      reunion_id: id,
      titre: point.titre,
      description: point.description ?? null,
      ordre: point.ordre ?? index,
      duree_minutes: point.duree_minutes ?? null,
      est_traite: false,
    }));

    const { data, error } = await supabase
      .from(TABLES.pointsOrdreJour)
      .insert(rows)
      .select('*')
      .order('ordre', { ascending: true });

    if (error) {
      handleSupabaseError(error, "Impossible d’enregistrer l'ordre du jour.");
    }

    return (data ?? []) as PointOrdreJour[];
  }

  async modifierPoint(
    reunionId: string,
    pointId: string,
    estTraite: boolean,
  ): Promise<PointOrdreJour> {
    await this.assurerExiste(reunionId);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.pointsOrdreJour)
      .update({ est_traite: estTraite })
      .eq('id', pointId)
      .eq('reunion_id', reunionId)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de mettre à jour le point.');
    }

    return data as PointOrdreJour;
  }

  async modifierParticipant(
    reunionId: string,
    participantId: string,
    statut: string,
  ): Promise<ParticipantReunion> {
    await this.assurerExiste(reunionId);
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.participantsReunion)
      .update({ statut })
      .eq('id', participantId)
      .eq('reunion_id', reunionId)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de mettre à jour le participant.');
    }

    return data as ParticipantReunion;
  }

  async approuver(id: string, validePar?: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);
    if (reunion.statut !== 'en_attente_validation') {
      throw new AppError(
        400,
        `Seule une réunion en attente de validation peut être approuvée (statut actuel : ${reunion.statut}).`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({ statut: 'planifiee' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’approuver la réunion.');
    }

    if (reunion.cree_par) {
      await supabase.from(TABLES.notifications).insert({
        profil_id: reunion.cree_par,
        type: 'reunion_approuvee',
        titre: 'Réunion approuvée',
        message: `Votre réunion « ${reunion.titre} » a été planifiée.`,
        lien: `/reunions/${id}`,
        metadonnees: { reunion_id: id, valide_par: validePar ?? null },
      });
    }

    return data as Reunion;
  }

  async refuser(id: string, refusePar?: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);
    if (reunion.statut !== 'en_attente_validation') {
      throw new AppError(
        400,
        `Seule une réunion en attente de validation peut être refusée (statut actuel : ${reunion.statut}).`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({ statut: 'refusee' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de refuser la réunion.');
    }

    if (reunion.cree_par) {
      await supabase.from(TABLES.notifications).insert({
        profil_id: reunion.cree_par,
        type: 'reunion_refusee',
        titre: 'Réunion refusée',
        message: `Votre proposition « ${reunion.titre} » n’a pas été validée.`,
        lien: `/reunions/${id}`,
        metadonnees: { reunion_id: id, refuse_par: refusePar ?? null },
      });
    }

    return data as Reunion;
  }

  private async assurerExiste(id: string): Promise<Reunion> {
    const supabase = requireSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLES.reunions)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'Réunion introuvable.');
    }

    return data as Reunion;
  }
}

export const reunionService = new ReunionService();
