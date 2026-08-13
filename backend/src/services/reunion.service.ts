import type {
  PaginatedResult,
  ParticipantReunion,
  PointOrdreJour,
  Profil,
  Reunion,
  ReunionDetail,
} from '@ogefmeeting/shared';
import { peutApprouverReunionPourDirections, TABLES } from '@ogefmeeting/shared';
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

function formaterDateFr(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Africa/Kinshasa',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function normaliserDirectionIds(input: {
  direction_id?: string | null;
  direction_ids?: string[];
}): string[] {
  if (input.direction_ids && input.direction_ids.length > 0) {
    return [...new Set(input.direction_ids)];
  }
  if (input.direction_id) return [input.direction_id];
  return [];
}

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

    const directionIds = normaliserDirectionIds(input);

    const { data, error } = await supabase
      .from(TABLES.reunions)
      .insert({
        titre: input.titre,
        description: input.description ?? null,
        type_reunion: input.type_reunion,
        date_prevue: input.date_prevue,
        lieu: input.lieu ?? null,
        direction_id: directionIds[0] ?? null,
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

    await this.synchroniserDirections(reunion.id, directionIds);

    // Le créateur est automatiquement participant
    if (input.cree_par) {
      await supabase.from(TABLES.participantsReunion).insert({
        reunion_id: reunion.id,
        profil_id: input.cree_par,
        statut: 'confirme',
      });
    }

    if (statut === 'en_attente_validation') {
      await this.notifierValidateurs(reunion, directionIds, input.cree_par ?? null);
    }

    return { ...reunion, direction_ids: directionIds };
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
      const { data: links, error: linksError } = await supabase
        .from(TABLES.reunionsDirections)
        .select('reunion_id')
        .eq('direction_id', direction_id);

      if (linksError) {
        handleSupabaseError(linksError, 'Impossible de filtrer par direction.');
      }

      const linkedIds = (links ?? []).map((l) => l.reunion_id as string);
      if (linkedIds.length > 0) {
        builder = builder.or(
          `direction_id.eq.${direction_id},id.in.(${linkedIds.join(',')})`,
        );
      } else {
        builder = builder.eq('direction_id', direction_id);
      }
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
    const items = (data ?? []) as Reunion[];
    const directionMap = await this.chargerDirectionIds(items.map((r) => r.id));

    return {
      items: items.map((r) => this.enrichirAvecDirections(r, directionMap)),
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

    const directionMap = await this.chargerDirectionIds([id]);
    const base = reunion as Reunion;
    const enrichie = this.enrichirAvecDirections(base, directionMap);
    const avecValidateur = await this.enrichirValidateur(enrichie);

    return {
      ...avecValidateur,
      participants: (participantsResult.data ?? []) as ParticipantReunion[],
      points_ordre_jour: (pointsResult.data ?? []) as PointOrdreJour[],
    };
  }

  async modifier(id: string, input: ModifierReunionInput): Promise<Reunion> {
    await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { direction_ids, ...rest } = input;
    const updatePayload: Record<string, unknown> = { ...rest };

    if (direction_ids !== undefined || input.direction_id !== undefined) {
      const ids = normaliserDirectionIds({
        direction_id: input.direction_id,
        direction_ids,
      });
      updatePayload.direction_id = ids[0] ?? null;
      await this.synchroniserDirections(id, ids);
    }

    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de modifier la réunion.');
    }

    const reunion = data as Reunion;
    const directionMap = await this.chargerDirectionIds([id]);
    return this.enrichirAvecDirections(reunion, directionMap);
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
   * Remplace la liste des participants.
   * Nouveaux invités : statut « invite », notif in-app + email réel (Resend) avec lien de confirmation.
   * Participants déjà présents : statut conservé (sauf créateur → confirme).
   */
  async gererParticipants(
    id: string,
    input: GererParticipantsInput,
  ): Promise<ParticipantReunion[]> {
    const reunion = await this.assurerExiste(id);
    const supabase = requireSupabaseAdmin();

    const { data: existants, error: existantsError } = await supabase
      .from(TABLES.participantsReunion)
      .select('*')
      .eq('reunion_id', id);

    if (existantsError) {
      handleSupabaseError(existantsError, 'Impossible de charger les participants.');
    }

    const anciensParProfil = new Map(
      ((existants ?? []) as ParticipantReunion[]).map((p) => [p.profil_id, p]),
    );

    const nouveauxIds = input.participants
      .map((p) => p.profil_id)
      .filter(
        (profilId) =>
          !anciensParProfil.has(profilId) && profilId !== reunion.cree_par,
      );

    const { error: deleteError } = await supabase
      .from(TABLES.participantsReunion)
      .delete()
      .eq('reunion_id', id);

    if (deleteError) {
      handleSupabaseError(deleteError, 'Impossible de mettre à jour les participants.');
    }

    if (input.participants.length === 0) {
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

    const rows = input.participants.map((p) => {
      const ancien = anciensParProfil.get(p.profil_id);
      const estCreateur = reunion.cree_par === p.profil_id;
      return {
        reunion_id: id,
        profil_id: p.profil_id,
        statut: estCreateur
          ? 'confirme'
          : (ancien?.statut ?? p.statut ?? 'invite'),
      };
    });

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

    // Nouveaux invités : notification in-app + email réel (Resend)
    if (nouveauxIds.length > 0) {
      const { data: profils } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom')
        .in('id', nouveauxIds);

      const dateTxt = formaterDateFr(reunion.date_prevue);
      const lieuTxt = reunion.lieu ? `\nLieu : ${reunion.lieu}` : '';
      const lienConfirmation = `/reunions/${id}/invitation`;

      await notificationService.creerPourProfils(
        (profils ?? []) as { id: string; email: string; prenom: string; nom: string }[],
        {
          type: 'invitation_reunion',
          titre: 'Invitation à une réunion',
          message:
            `Vous êtes invité(e) à la réunion « ${reunion.titre} ».\n` +
            `Date : ${dateTxt}${lieuTxt}\n\n` +
            `Merci de confirmer votre présence dans Ogefmeeting (bouton ci-dessous ou onglet Notifications).`,
          lien: lienConfirmation,
          emailSujet: `[Ogefmeeting] Invitation — ${reunion.titre}`,
          emailBoutonLibelle: 'Confirmer mon invitation',
          metadonnees: { reunion_id: id },
        },
      );
    }

    return (data ?? []) as ParticipantReunion[];
  }

  /**
   * L’invité connecté confirme ou décline sa participation.
   */
  async repondreInvitation(
    reunionId: string,
    profilId: string,
    reponse: 'confirme' | 'absent',
  ): Promise<ParticipantReunion> {
    await this.assurerExiste(reunionId);
    const supabase = requireSupabaseAdmin();

    const { data: participant, error: findError } = await supabase
      .from(TABLES.participantsReunion)
      .select('*')
      .eq('reunion_id', reunionId)
      .eq('profil_id', profilId)
      .maybeSingle();

    if (findError) {
      handleSupabaseError(findError, 'Impossible de trouver votre invitation.');
    }
    if (!participant) {
      throw new AppError(404, 'Vous n’êtes pas invité(e) à cette réunion.');
    }

    const actuel = participant as ParticipantReunion;
    if (actuel.statut === 'present') {
      throw new AppError(400, 'Votre présence est déjà enregistrée pour cette réunion.');
    }

    const { data, error } = await supabase
      .from(TABLES.participantsReunion)
      .update({ statut: reponse })
      .eq('id', actuel.id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’enregistrer votre réponse.');
    }

    return data as ParticipantReunion;
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

  async approuver(
    id: string,
    validePar?: string,
    contexte?: {
      role?: string;
      fonction?: string | null;
      direction_id?: string | null;
    },
  ): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);
    if (reunion.statut !== 'en_attente_validation') {
      if (reunion.valide_par) {
        const nom = await this.nomValidateur(reunion.valide_par);
        throw new AppError(
          409,
          `Cette réunion a déjà été validée${nom ? ` par ${nom}` : ''}.`,
        );
      }
      throw new AppError(
        400,
        `Seule une réunion en attente de validation peut être approuvée (statut actuel : ${reunion.statut}).`,
      );
    }

    const directionMap = await this.chargerDirectionIds([id]);
    const directionIds =
      directionMap.get(id) ??
      (reunion.direction_id ? [reunion.direction_id] : []);

    if (
      contexte &&
      !peutApprouverReunionPourDirections(
        contexte.role as Parameters<typeof peutApprouverReunionPourDirections>[0],
        contexte.fonction,
        directionIds,
        contexte.direction_id,
      )
    ) {
      throw new AppError(
        403,
        'Vous ne pouvez valider que les réunions des directions dont vous relévez.',
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({
        statut: 'planifiee',
        valide_par: validePar ?? null,
        valide_le: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('statut', 'en_attente_validation')
      .select('*')
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'Impossible d’approuver la réunion.');
    }

    if (!data) {
      const actuelle = await this.assurerExiste(id);
      if (actuelle.valide_par) {
        const nom = await this.nomValidateur(actuelle.valide_par);
        throw new AppError(
          409,
          `Cette réunion a déjà été validée${nom ? ` par ${nom}` : ''}.`,
        );
      }
      throw new AppError(400, 'Impossible d’approuver cette réunion.');
    }

    const valideurNom = validePar ? await this.nomValidateur(validePar) : null;

    if (reunion.cree_par) {
      const { data: createur } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom')
        .eq('id', reunion.cree_par)
        .maybeSingle();

      if (createur) {
        await notificationService.creerPourProfils(
          [createur as { id: string; email: string; prenom: string; nom: string }],
          {
            type: 'reunion_approuvee',
            titre: 'Réunion approuvée',
            message:
              `Votre réunion « ${reunion.titre} » a été planifiée` +
              (valideurNom ? ` par ${valideurNom}.` : '.'),
            lien: `/reunions/${id}`,
            emailSujet: `[Ogefmeeting] Réunion planifiée — ${reunion.titre}`,
            metadonnees: { reunion_id: id, valide_par: validePar ?? null },
          },
        );
      }
    }

    const enrichie = this.enrichirAvecDirections(data as Reunion, directionMap);
    return {
      ...(await this.enrichirValidateur(enrichie)),
      direction_ids: directionIds,
    };
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
      const { data: createur } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom')
        .eq('id', reunion.cree_par)
        .maybeSingle();

      if (createur) {
        await notificationService.creerPourProfils(
          [createur as { id: string; email: string; prenom: string; nom: string }],
          {
            type: 'reunion_refusee',
            titre: 'Réunion refusée',
            message: `Votre proposition « ${reunion.titre} » n’a pas été validée.`,
            lien: `/reunions/${id}`,
            emailSujet: `[Ogefmeeting] Réunion refusée — ${reunion.titre}`,
            metadonnees: { reunion_id: id, refuse_par: refusePar ?? null },
          },
        );
      }
    }

    return data as Reunion;
  }

  private async notifierValidateurs(
    reunion: Reunion,
    directionIds: string[],
    createurId: string | null,
  ): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { data: profils, error } = await supabase
      .from(TABLES.profils)
      .select('id, email, prenom, nom, role, fonction, direction_id')
      .eq('est_actif', true);

    if (error) {
      handleSupabaseError(error, 'Impossible de notifier les validateurs.');
    }

    let createurNom = 'Un membre';
    if (createurId) {
      const { data: createur } = await supabase
        .from(TABLES.profils)
        .select('prenom, nom')
        .eq('id', createurId)
        .maybeSingle();
      if (createur) {
        createurNom = `${createur.prenom} ${createur.nom}`.trim();
      }
    }

    const dateTxt = formaterDateFr(reunion.date_prevue);
    const validateurs = ((profils ?? []) as Profil[]).filter((p) => {
      if (p.id === createurId) return false;
      return peutApprouverReunionPourDirections(
        p.role,
        p.fonction,
        directionIds,
        p.direction_id,
      );
    });

    if (validateurs.length === 0) return;

    await notificationService.creerPourProfils(
      validateurs.map((p) => ({
        id: p.id,
        email: p.email,
        prenom: p.prenom,
        nom: p.nom,
      })),
      {
        type: 'reunion_a_valider',
        titre: 'Réunion à valider',
        message:
          `${createurNom} propose « ${reunion.titre} ».\n` +
          `Date : ${dateTxt}\n\n` +
          `Validez pour planifier cette réunion.`,
        lien: `/reunions/${reunion.id}`,
        emailSujet: `[Ogefmeeting] À valider — ${reunion.titre}`,
        emailBoutonLibelle: 'Valider la réunion',
        metadonnees: { reunion_id: reunion.id, cree_par: createurId },
      },
    );
  }

  private async nomValidateur(profilId: string): Promise<string | null> {
    const supabase = requireSupabaseAdmin();
    const { data } = await supabase
      .from(TABLES.profils)
      .select('prenom, nom')
      .eq('id', profilId)
      .maybeSingle();
    if (!data) return null;
    return `${data.prenom} ${data.nom}`.trim();
  }

  private async enrichirValidateur(reunion: Reunion): Promise<Reunion> {
    if (!reunion.valide_par) return reunion;
    const nom = await this.nomValidateur(reunion.valide_par);
    return { ...reunion, valide_par_nom: nom };
  }

  private async synchroniserDirections(
    reunionId: string,
    directionIds: string[],
  ): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const unique = [...new Set(directionIds.filter(Boolean))];

    const { error: deleteError } = await supabase
      .from(TABLES.reunionsDirections)
      .delete()
      .eq('reunion_id', reunionId);

    if (deleteError) {
      handleSupabaseError(deleteError, 'Impossible de mettre à jour les directions.');
    }

    if (unique.length === 0) return;

    const { error: insertError } = await supabase.from(TABLES.reunionsDirections).insert(
      unique.map((direction_id) => ({
        reunion_id: reunionId,
        direction_id,
      })),
    );

    if (insertError) {
      handleSupabaseError(insertError, 'Impossible d’enregistrer les directions.');
    }
  }

  private async chargerDirectionIds(
    reunionIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (reunionIds.length === 0) return map;

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunionsDirections)
      .select('reunion_id, direction_id')
      .in('reunion_id', reunionIds);

    if (error) {
      handleSupabaseError(error, 'Impossible de charger les directions.');
    }

    for (const row of data ?? []) {
      const reunionId = row.reunion_id as string;
      const list = map.get(reunionId) ?? [];
      list.push(row.direction_id as string);
      map.set(reunionId, list);
    }

    return map;
  }

  private enrichirAvecDirections(
    reunion: Reunion,
    map: Map<string, string[]>,
  ): Reunion {
    const ids = map.get(reunion.id);
    const direction_ids =
      ids && ids.length > 0
        ? ids
        : reunion.direction_id
          ? [reunion.direction_id]
          : [];
    return { ...reunion, direction_ids };
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
