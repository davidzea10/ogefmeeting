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

export class ReunionService {
  async creer(input: CreerReunionInput): Promise<Reunion> {
    const supabase = requireSupabaseAdmin();

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
        statut: 'planifiee',
      })
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de créer la réunion.');
    }

    return data as Reunion;
  }

  async lister(query: ListerReunionsQuery): Promise<PaginatedResult<Reunion>> {
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

    let idsParticipant: string[] | null = null;
    if (participant_id) {
      const { data: liens, error: liensError } = await supabase
        .from(TABLES.participantsReunion)
        .select('reunion_id')
        .eq('profil_id', participant_id);

      if (liensError) {
        handleSupabaseError(liensError, 'Impossible de filtrer par participant.');
      }

      idsParticipant = (liens ?? []).map((l) => l.reunion_id as string);
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

  async obtenirParId(id: string): Promise<ReunionDetail> {
    const supabase = requireSupabaseAdmin();

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
      return [];
    }

    const rows = input.participants.map((p) => ({
      reunion_id: id,
      profil_id: p.profil_id,
      statut: p.statut,
    }));

    const { data, error } = await supabase
      .from(TABLES.participantsReunion)
      .insert(rows)
      .select('*');

    if (error) {
      handleSupabaseError(error, 'Impossible d’ajouter les participants.');
    }

    // Notifications d'invitation (best-effort)
    const notifications = input.participants.map((p) => ({
      profil_id: p.profil_id,
      type: 'invitation_reunion',
      titre: 'Invitation à une réunion',
      message: `Vous êtes invité(e) à « ${reunion.titre} ».`,
      lien: `/reunions/${id}`,
      metadonnees: { reunion_id: id },
    }));

    await supabase.from(TABLES.notifications).insert(notifications);

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
