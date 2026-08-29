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
import { tenterEnvoiRapportSiPret } from './cr-notification.service.js';
import { effacerTranscriptionLiveBroadcast } from '../ws/transcription-broadcast.js';
import { notificationService } from './notification.service.js';

export type ScopeReunion = {
  /** Si défini : ne renvoyer que les réunions où ce profil est participant */
  limiterAuProfilId?: string | null;
};

/** Met à jour statut présent ; retente sans present_le si la colonne n'existe pas encore. */
async function marquerParticipantPresent(
  supabase: ReturnType<typeof requireSupabaseAdmin>,
  participantId: string,
  maintenant: string,
): Promise<ParticipantReunion> {
  const avecHorodatage = await supabase
    .from(TABLES.participantsReunion)
    .update({ statut: 'present', present_le: maintenant })
    .eq('id', participantId)
    .select('*')
    .single();

  if (!avecHorodatage.error) {
    return avecHorodatage.data as ParticipantReunion;
  }

  const msg = avecHorodatage.error.message ?? '';
  const colonneAbsente =
    msg.includes('present_le') ||
    avecHorodatage.error.code === '42703' ||
    msg.includes('schema cache');

  if (!colonneAbsente) {
    handleSupabaseError(avecHorodatage.error, 'Impossible de marquer votre présence.');
  }

  const sansHorodatage = await supabase
    .from(TABLES.participantsReunion)
    .update({ statut: 'present' })
    .eq('id', participantId)
    .select('*')
    .single();

  if (sansHorodatage.error) {
    handleSupabaseError(sansHorodatage.error, 'Impossible de marquer votre présence.');
  }

  return sansHorodatage.data as ParticipantReunion;
}

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

  async modifier(
    id: string,
    input: ModifierReunionInput,
    modifieParProfilId?: string | null,
  ): Promise<Reunion> {
    const reunionAvant = await this.assurerExiste(id);
    if (reunionAvant.statut === 'cloturee' || reunionAvant.statut === 'archivee') {
      throw new AppError(
        400,
        'Impossible de modifier une réunion clôturée (ou archivée).',
      );
    }
    const supabase = requireSupabaseAdmin();

    const etaitDepasseeAvantModification =
      reunionAvant.statut === 'planifiee' &&
      new Date(reunionAvant.date_prevue as string).getTime() < Date.now();

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

    if (
      etaitDepasseeAvantModification &&
      reunion.statut === 'planifiee' &&
      reunion.date_prevue
    ) {
      try {
        const dateLabel = new Date(reunion.date_prevue as string).toLocaleString(
          'fr-FR',
          { dateStyle: 'full', timeStyle: 'short' },
        );
        const lieuPart = reunion.lieu ? ` — ${reunion.lieu}` : '';

        const metaCle = {
          reunion_id: reunion.id,
          kind: 'heure_depassee_modifiee',
          date_prevue: reunion.date_prevue,
        };

        const { data: participants } = await supabase
          .from(TABLES.participantsReunion)
          .select('profil_id, statut')
          .eq('reunion_id', reunion.id)
          .in('statut', ['invite', 'confirme', 'present']);

        const destinataireIds = new Set<string>();
        if (reunion.cree_par) destinataireIds.add(reunion.cree_par as string);
        if (modifieParProfilId) destinataireIds.add(modifieParProfilId);
        for (const p of participants ?? []) {
          if (p.profil_id) destinataireIds.add(p.profil_id as string);
        }

        const ids = [...destinataireIds];
        if (ids.length > 0) {
          const { data: profils } = await supabase
            .from(TABLES.profils)
            .select('id, email, prenom, nom, est_actif')
            .in('id', ids)
            .eq('est_actif', true);

          const destinataires: any[] = [];
          for (const profil of profils ?? []) {
            const { data: deja } = await supabase
              .from(TABLES.notifications)
              .select('id')
              .eq('profil_id', profil.id)
              .eq('type', 'reunion_heure_depassee_modifiee')
              .contains('metadonnees', metaCle)
              .maybeSingle();
            if (!deja) destinataires.push(profil);
          }

          if (destinataires.length > 0) {
            await notificationService.creerPourProfils(
              destinataires,
              {
                type: 'reunion_heure_depassee_modifiee',
                titre: 'Réunion replanifiée',
                message:
                  `L’heure prévue de la réunion « ${reunion.titre} » a été replanifiée.\n\n` +
                  `Nouvelle heure : ${dateLabel}${lieuPart}.\n\n` +
                  `Attendez que l’organisateur lance le live.`,
                lien: `/reunions/${reunion.id}`,
                emailSujet: `[Ogefmeeting] Réunion replanifiée — ${reunion.titre}`,
                emailBoutonLibelle: 'Voir la réunion',
                metadonnees: metaCle,
              },
            );
          }
        }
      } catch {
        /* best-effort */
      }
    }

    return this.enrichirAvecDirections(reunion, directionMap);
  }

  /** Soft delete : passe le statut à archivee */
  async archiver(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut === 'en_cours' || reunion.statut === 'en_pause') {
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

  async demarrer(id: string, demarreParProfilId?: string | null): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'planifiee') {
      throw new AppError(
        400,
        `Impossible de démarrer une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const maintenant = new Date().toISOString();
    const etaitDepassee =
      new Date(reunion.date_prevue as string).getTime() < Date.now();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({
        statut: 'en_cours',
        date_debut: maintenant,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de démarrer la réunion.');
    }

    const demarree = data as Reunion;
    void this.notifierInvitesReunionDemarree(
      demarree,
      demarreParProfilId ?? null,
      etaitDepassee,
    );

    return demarree;
  }

  /** Alerte les invités dès que la réunion passe en cours (best-effort, 1 notif / invité). */
  private async notifierInvitesReunionDemarree(
    reunion: Pick<Reunion, 'id' | 'titre' | 'lieu'>,
    demarreParProfilId: string | null,
    notifierOrganisateur?: boolean,
  ): Promise<void> {
    try {
      const supabase = requireSupabaseAdmin();
      const { data: participants, error } = await supabase
        .from(TABLES.participantsReunion)
        .select('profil_id, statut')
        .eq('reunion_id', reunion.id)
        .in('statut', ['invite', 'confirme']);

      if (error || !participants?.length) return;

      const ids = participants
        .map((p) => p.profil_id as string)
        .filter((profilId) => profilId && profilId !== demarreParProfilId);

      if (ids.length === 0) return;

      const { data: profils } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom, est_actif')
        .in('id', ids)
        .eq('est_actif', true);

      const metaCle = { reunion_id: reunion.id, kind: 'demarrage' };
      const destinataires: { id: string; email?: string | null; prenom?: string; nom?: string }[] =
        [];

      for (const profil of profils ?? []) {
        const { data: deja } = await supabase
          .from(TABLES.notifications)
          .select('id')
          .eq('profil_id', profil.id)
          .eq('type', 'reunion_demarree')
          .contains('metadonnees', metaCle)
          .maybeSingle();
        if (!deja) destinataires.push(profil);
      }

      if (destinataires.length === 0) return;

      const lieuPart = reunion.lieu ? ` — ${reunion.lieu}` : '';
      await notificationService.creerPourProfils(destinataires, {
        type: 'reunion_demarree',
        titre: 'La réunion a commencé',
        message:
          `« ${reunion.titre} » est en cours${lieuPart}.\n\n` +
          `Rejoignez le mode live pour suivre l’ordre du jour en direct.`,
        lien: `/reunions/${reunion.id}/live`,
        emailSujet: `[Ogefmeeting] En cours — ${reunion.titre}`,
        emailBoutonLibelle: 'Rejoindre le live',
        metadonnees: metaCle,
      });

      // Optionnel : notifier le démarrage à l’organisateur/ayant-droit si l’heure était dépassée.
      if (notifierOrganisateur && demarreParProfilId) {
        const { data: organisateur } = await supabase
          .from(TABLES.profils)
          .select('id, email, prenom, nom, est_actif')
          .eq('id', demarreParProfilId)
          .eq('est_actif', true)
          .maybeSingle();

        if (organisateur) {
          const { data: deja } = await supabase
            .from(TABLES.notifications)
            .select('id')
            .eq('profil_id', organisateur.id)
            .eq('type', 'reunion_demarree')
            .contains('metadonnees', metaCle)
            .maybeSingle();

          if (!deja) {
            await notificationService.creerPourProfils(
              [organisateur as any],
              {
                type: 'reunion_demarree',
                titre: 'La réunion a commencé',
                message:
                  `Vous avez démarré « ${reunion.titre} »${lieuPart}.`,
                lien: `/reunions/${reunion.id}/live`,
                emailSujet: `[Ogefmeeting] En cours — ${reunion.titre}`,
                emailBoutonLibelle: 'Rejoindre le live',
                metadonnees: metaCle,
              },
            );
          }
        }
      }
    } catch {
      /* best-effort */
    }
  }

  /**
   * Prépare une réunion de test live (admin) liée à la direction DANTIC.
   * Réutilise une réunion « [TEST LIVE] » déjà en_cours si elle existe.
   */
  async preparerTesteLive(adminProfilId: string): Promise<ReunionDetail> {
    const supabase = requireSupabaseAdmin();
    const TITRE_TEST = '[TEST LIVE] Audio DANTIC';

    const { data: direction, error: dirErr } = await supabase
      .from(TABLES.directions)
      .select('id, code, nom')
      .eq('code', 'DANTIC')
      .maybeSingle();

    if (dirErr) {
      handleSupabaseError(dirErr, 'Impossible de charger la direction DANTIC.');
    }
    if (!direction) {
      throw new AppError(
        404,
        'Direction DANTIC introuvable. Vérifiez que les seeds / migrations sont appliqués.',
      );
    }

    const directionId = (direction as { id: string }).id;

    const { data: existante, error: existErr } = await supabase
      .from(TABLES.reunions)
      .select('id, statut')
      .eq('titre', TITRE_TEST)
      .eq('statut', 'en_cours')
      .order('cree_le', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existErr) {
      handleSupabaseError(existErr, 'Impossible de chercher la réunion de test.');
    }

    let reunionId: string;

    if (existante?.id) {
      reunionId = existante.id as string;
    } else {
      const creee = await this.creer(
        {
          titre: TITRE_TEST,
          description:
            'Réunion de test admin — enregistrement audio / futur STT (DANTIC).',
          type_reunion: 'technique',
          date_prevue: new Date().toISOString(),
          lieu: 'Salle test DANTIC',
          direction_id: directionId,
          direction_ids: [directionId],
          cree_par: adminProfilId,
        },
        { directementPlanifiee: true },
      );

      await this.gererOrdreJour(creee.id, {
        points: [
          {
            titre: 'Test micro / enregistrement',
            description: 'Vérifier le niveau sonore et la lecture.',
            ordre: 0,
            duree_minutes: 10,
          },
          {
            titre: 'Test modules IA (à venir)',
            description: 'Placeholder pour transcription / empreinte vocale.',
            ordre: 1,
            duree_minutes: 10,
          },
        ],
      });

      const demarree = await this.demarrer(creee.id);
      reunionId = demarree.id;
    }

    // Garantir que l’admin est participant
    const { data: deja } = await supabase
      .from(TABLES.participantsReunion)
      .select('id')
      .eq('reunion_id', reunionId)
      .eq('profil_id', adminProfilId)
      .maybeSingle();

    if (!deja) {
      await supabase.from(TABLES.participantsReunion).insert({
        reunion_id: reunionId,
        profil_id: adminProfilId,
        statut: 'present',
      });
    } else {
      await supabase
        .from(TABLES.participantsReunion)
        .update({ statut: 'present' })
        .eq('id', (deja as { id: string }).id);
    }

    return this.obtenirParId(reunionId);
  }

  async cloturer(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(
        400,
        `Impossible de clôturer une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const dateDebut = reunion.date_debut ?? new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({
        statut: 'cloturee',
        date_fin: new Date().toISOString(),
        // Heure réelle de début = référence officielle (écrase la planification).
        date_prevue: dateDebut,
        date_debut: dateDebut,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de clôturer la réunion.');
    }

    // Absents automatiques : tout participant non passé « présent » en live.
    await supabase
      .from(TABLES.participantsReunion)
      .update({ statut: 'absent' })
      .eq('reunion_id', id)
      .neq('statut', 'present');

    const reunionCloturee = data as Reunion;
    await this.effacerTranscriptionLive(id);
    // Si un CR est déjà validé, envoi automatique du PDF aux participants
    void tenterEnvoiRapportSiPret(id);
    void this.notifierInvitesReunionCloturee(reunionCloturee);

    return reunionCloturee;
  }

  /**
   * Annule un live en cours : retour à « planifiée », sans conserver audio / STT / CR brouillon.
   * Les réunions de test `[TEST LIVE]` sont archivées pour ne pas rester dans le planning.
   */
  async annulerLive(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(
        400,
        `Impossible d’annuler le live d’une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();

    // Purge audio (stockage + DB)
    const { data: audios } = await supabase
      .from(TABLES.enregistrements)
      .select('id, chemin_stockage')
      .eq('reunion_id', id);

    const chemins = (audios ?? [])
      .map((a) => a.chemin_stockage as string)
      .filter(Boolean);
    if (chemins.length > 0) {
      await supabase.storage.from('recordings').remove(chemins);
    }
    await supabase.from(TABLES.enregistrements).delete().eq('reunion_id', id);

    // Purge transcriptions
    await supabase.from(TABLES.transcriptions).delete().eq('reunion_id', id);

    // Purge comptes rendus brouillon éventuels (créés par erreur avant clôture)
    await supabase
      .from(TABLES.comptesRendus)
      .delete()
      .eq('reunion_id', id)
      .eq('statut', 'brouillon');

    // Remet les points ODJ comme non traités
    await supabase
      .from(TABLES.pointsOrdreJour)
      .update({ est_traite: false })
      .eq('reunion_id', id);

    // Présences live → repasse en « confirmé » (l’invitation reste valide)
    await supabase
      .from(TABLES.participantsReunion)
      .update({ statut: 'confirme', present_le: null })
      .eq('reunion_id', id)
      .eq('statut', 'present');

    const estTestLive = reunion.titre.trim().startsWith('[TEST LIVE]');

    if (estTestLive) {
      const { data, error } = await supabase
        .from(TABLES.reunions)
        .update({
          statut: 'archivee',
          date_debut: null,
          date_fin: null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        handleSupabaseError(error, 'Impossible d’annuler le test live.');
      }
      return data as Reunion;
    }

    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({
        statut: 'planifiee',
        date_debut: null,
        date_fin: null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible d’annuler le live.');
    }

    await this.effacerTranscriptionLive(id);
    return data as Reunion;
  }

  /** Informe les invités qui n’ont pas répondu que la réunion est déjà clôturée. */
  private async notifierInvitesReunionCloturee(
    reunion: Pick<Reunion, 'id' | 'titre'>,
  ): Promise<void> {
    try {
      const supabase = requireSupabaseAdmin();
      const { data: participants, error } = await supabase
        .from(TABLES.participantsReunion)
        .select('profil_id')
        .eq('reunion_id', reunion.id)
        .eq('statut', 'invite');

      if (error || !participants?.length) return;

      const ids = participants
        .map((p) => p.profil_id as string)
        .filter(Boolean);
      if (ids.length === 0) return;

      const { data: profils } = await supabase
        .from(TABLES.profils)
        .select('id, email, prenom, nom, est_actif')
        .in('id', ids)
        .eq('est_actif', true);

      const metaCle = { reunion_id: reunion.id, kind: 'cloture_sans_reponse' };
      const destinataires: { id: string; email?: string | null; prenom?: string; nom?: string }[] =
        [];

      for (const profil of profils ?? []) {
        const { data: deja } = await supabase
          .from(TABLES.notifications)
          .select('id')
          .eq('profil_id', profil.id)
          .eq('type', 'reunion_cloturee')
          .contains('metadonnees', metaCle)
          .maybeSingle();
        if (!deja) destinataires.push(profil);
      }

      if (destinataires.length === 0) return;

      await notificationService.creerPourProfils(destinataires, {
        type: 'reunion_cloturee',
        titre: 'Réunion déjà clôturée',
        message:
          `La réunion « ${reunion.titre} » a déjà eu lieu et est clôturée.\n\n` +
          `Vous n’avez pas confirmé votre présence à temps ; la confirmation n’est plus possible.`,
        lien: `/reunions/${reunion.id}`,
        emailSujet: `[Ogefmeeting] Clôturée — ${reunion.titre}`,
        emailBoutonLibelle: 'Voir la réunion',
        metadonnees: metaCle,
      });
    } catch {
      /* best-effort */
    }
  }

  async mettreEnPause(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'en_cours') {
      throw new AppError(
        400,
        `Impossible de mettre en pause une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({ statut: 'en_pause' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de mettre la réunion en pause.');
    }

    return data as Reunion;
  }

  async reprendre(id: string): Promise<Reunion> {
    const reunion = await this.assurerExiste(id);

    if (reunion.statut !== 'en_pause') {
      throw new AppError(
        400,
        `Impossible de reprendre une réunion au statut « ${reunion.statut} ».`,
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLES.reunions)
      .update({ statut: 'en_cours' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      handleSupabaseError(error, 'Impossible de reprendre la réunion.');
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
    if (reunion.statut === 'cloturee' || reunion.statut === 'archivee') {
      throw new AppError(
        400,
        'Impossible de modifier des participants : la réunion est clôturée.',
      );
    }
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
    const reunion = await this.assurerExiste(reunionId);

    if (reunion.statut === 'cloturee' || reunion.statut === 'archivee') {
      throw new AppError(
        400,
        'Cette réunion a déjà eu lieu et est clôturée. Vous ne pouvez plus confirmer votre présence.',
      );
    }

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

    const misAJour = data as ParticipantReunion;
    void this.alerterOrganisateurReponseInvitation(reunion, profilId, reponse);

    return misAJour;
  }

  /** Alerte in-app pour l’organisateur (visible aussi dans l’onglet Informations). */
  private async alerterOrganisateurReponseInvitation(
    reunion: Pick<Reunion, 'id' | 'titre' | 'cree_par'>,
    repondantProfilId: string,
    reponse: 'confirme' | 'absent',
  ): Promise<void> {
    try {
      if (!reunion.cree_par || reunion.cree_par === repondantProfilId) return;
      const supabase = requireSupabaseAdmin();

      const [{ data: organisateur }, { data: repondant }] = await Promise.all([
        supabase
          .from(TABLES.profils)
          .select('id, email, prenom, nom, est_actif')
          .eq('id', reunion.cree_par)
          .eq('est_actif', true)
          .maybeSingle(),
        supabase
          .from(TABLES.profils)
          .select('prenom, nom')
          .eq('id', repondantProfilId)
          .maybeSingle(),
      ]);

      if (!organisateur) return;

      const nom =
        repondant
          ? `${(repondant as { prenom?: string }).prenom ?? ''} ${(repondant as { nom?: string }).nom ?? ''}`.trim()
          : 'Un participant';
      const verbe = reponse === 'confirme' ? 'a confirmé sa présence' : 'a décliné l’invitation';

      await notificationService.creerPourProfils(
        [organisateur as { id: string; email?: string | null; prenom?: string; nom?: string }],
        {
          type: 'invitation_repondue',
          titre: reponse === 'confirme' ? 'Présence confirmée' : 'Invitation déclinée',
          message: `${nom || 'Un participant'} ${verbe} pour « ${reunion.titre} ».`,
          lien: `/reunions/${reunion.id}?tab=informations`,
          emailSujet: `[Ogefmeeting] ${verbe} — ${reunion.titre}`,
          emailBoutonLibelle: 'Voir la réunion',
          metadonnees: {
            reunion_id: reunion.id,
            kind: 'reponse_invitation',
            reponse,
            profil_id: repondantProfilId,
          },
        },
      );
    } catch {
      /* best-effort */
    }
  }

  /**
   * Marque le participant connecté comme « présent » dès qu’il entre en mode live.
   */
  async rejoindreLive(
    reunionId: string,
    profilId: string,
  ): Promise<ParticipantReunion> {
    const reunion = await this.assurerExiste(reunionId);

    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(
        400,
        'Vous ne pouvez marquer votre présence que pendant une réunion en cours.',
      );
    }

    const supabase = requireSupabaseAdmin();
    const { data: participant, error: findError } = await supabase
      .from(TABLES.participantsReunion)
      .select('*')
      .eq('reunion_id', reunionId)
      .eq('profil_id', profilId)
      .maybeSingle();

    if (findError) {
      handleSupabaseError(findError, 'Impossible de trouver votre participation.');
    }
    if (!participant) {
      throw new AppError(404, 'Vous n’êtes pas participant de cette réunion.');
    }

    const actuel = participant as ParticipantReunion;
    if (actuel.statut === 'present') {
      if (actuel.present_le) return actuel;
      try {
        const { data: corrige, error: corrigeErr } = await supabase
          .from(TABLES.participantsReunion)
          .update({ present_le: new Date().toISOString() })
          .eq('id', actuel.id)
          .select('*')
          .single();
        if (!corrigeErr) return corrige as ParticipantReunion;
      } catch {
        /* colonne present_le absente */
      }
      return actuel;
    }

    const maintenant = new Date().toISOString();
    return marquerParticipantPresent(supabase, actuel.id, maintenant);
  }

  /** Publie le texte STT en cours pour tous les participants du live. */
  async synchroniserTranscriptionLive(
    reunionId: string,
    texte: string,
    interim: string | null,
  ): Promise<void> {
    const reunion = await this.assurerExiste(reunionId);
    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(400, 'La transcription live n’est active qu’en réunion en cours.');
    }

    const supabase = requireSupabaseAdmin();
    const patch: Record<string, string | null> = {
      transcription_live_texte: texte.trim() || null,
      transcription_live_interim: interim?.trim() || null,
    };

    const { error } = await supabase.from(TABLES.reunions).update(patch).eq('id', reunionId);

    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('transcription_live') ||
        error.code === '42703' ||
        msg.includes('schema cache')
      ) {
        return;
      }
      handleSupabaseError(error, 'Impossible de synchroniser la transcription live.');
    }
  }

  /** Efface le texte STT partagé (clôture / annulation). */
  async effacerTranscriptionLive(reunionId: string): Promise<void> {
    effacerTranscriptionLiveBroadcast(reunionId);
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase
      .from(TABLES.reunions)
      .update({
        transcription_live_texte: null,
        transcription_live_interim: null,
      })
      .eq('id', reunionId);

    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('transcription_live') ||
        error.code === '42703' ||
        msg.includes('schema cache')
      ) {
        return;
      }
      handleSupabaseError(error, 'Impossible d’effacer la transcription live.');
    }
  }

  /**
   * Met à jour l'ordre du jour : upsert des points existants, insertion des nouveaux,
   * suppression des points retirés. Préserve est_traite sauf si fourni explicitement.
   */
  async gererOrdreJour(id: string, input: GererOrdreJourInput): Promise<PointOrdreJour[]> {
    const reunion = await this.assurerExiste(id);
    if (reunion.statut === 'cloturee' || reunion.statut === 'archivee') {
      throw new AppError(
        400,
        'Impossible de modifier l’ordre du jour : la réunion est clôturée.',
      );
    }
    const supabase = requireSupabaseAdmin();

    const { data: existingRows, error: fetchError } = await supabase
      .from(TABLES.pointsOrdreJour)
      .select('id, est_traite')
      .eq('reunion_id', id);

    if (fetchError) {
      handleSupabaseError(fetchError, "Impossible de lire l'ordre du jour.");
    }

    const existingMap = new Map(
      (existingRows ?? []).map((row) => [row.id as string, row.est_traite as boolean]),
    );

    const keptIds = input.points
      .map((point) => point.id)
      .filter((pointId): pointId is string => Boolean(pointId && existingMap.has(pointId)));

    const idsToDelete = [...existingMap.keys()].filter((pointId) => !keptIds.includes(pointId));

    if (idsToDelete.length > 0) {
      const { error: deleteRemovedError } = await supabase
        .from(TABLES.pointsOrdreJour)
        .delete()
        .in('id', idsToDelete)
        .eq('reunion_id', id);

      if (deleteRemovedError) {
        handleSupabaseError(deleteRemovedError, "Impossible de mettre à jour l'ordre du jour.");
      }
    }

    for (const [index, point] of input.points.entries()) {
      const ordre = point.ordre ?? index;
      const payload = {
        titre: point.titre,
        description: point.description ?? null,
        ordre,
        duree_minutes: point.duree_minutes ?? null,
      };

      if (point.id && existingMap.has(point.id)) {
        const estTraite = point.est_traite ?? existingMap.get(point.id) ?? false;
        const { error: updateError } = await supabase
          .from(TABLES.pointsOrdreJour)
          .update({ ...payload, est_traite: estTraite })
          .eq('id', point.id)
          .eq('reunion_id', id);

        if (updateError) {
          handleSupabaseError(updateError, "Impossible de mettre à jour un point de l'ordre du jour.");
        }
        continue;
      }

      const { error: insertError } = await supabase.from(TABLES.pointsOrdreJour).insert({
        reunion_id: id,
        ...payload,
        est_traite: point.est_traite ?? false,
      });

      if (insertError) {
        handleSupabaseError(insertError, "Impossible d'ajouter un point à l'ordre du jour.");
      }
    }

    const { data, error } = await supabase
      .from(TABLES.pointsOrdreJour)
      .select('*')
      .eq('reunion_id', id)
      .order('ordre', { ascending: true });

    if (error) {
      handleSupabaseError(error, "Impossible de relire l'ordre du jour.");
    }

    return (data ?? []) as PointOrdreJour[];
  }

  async modifierPoint(
    reunionId: string,
    pointId: string,
    estTraite: boolean,
  ): Promise<PointOrdreJour> {
    const reunion = await this.assurerExiste(reunionId);
    if (reunion.statut === 'cloturee' || reunion.statut === 'archivee') {
      throw new AppError(
        400,
        'Impossible de modifier un point : la réunion est clôturée.',
      );
    }
    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
      throw new AppError(
        400,
        `Impossible de modifier un point au statut « ${reunion.statut} ».`,
      );
    }
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
    _opts?: { estOrganisateur?: boolean },
  ): Promise<ParticipantReunion> {
    const reunion = await this.assurerExiste(reunionId);

    const live = reunion.statut === 'en_cours' || reunion.statut === 'en_pause';
    const cloturee = reunion.statut === 'cloturee';

    if (!live && !cloturee) {
      throw new AppError(
        400,
        `Impossible de modifier la présence au statut « ${reunion.statut} ».`,
      );
    }

    // Après clôture : correction manuelle (présent / absent uniquement).
    if (cloturee && statut !== 'present' && statut !== 'absent') {
      throw new AppError(
        400,
        'Après clôture, seuls les statuts « présent » et « absent » sont autorisés.',
      );
    }

    const supabase = requireSupabaseAdmin();

    const patch: { statut: string; present_le?: string | null } = { statut };
    if (statut === 'present') {
      const { data: actuel } = await supabase
        .from(TABLES.participantsReunion)
        .select('present_le')
        .eq('id', participantId)
        .eq('reunion_id', reunionId)
        .maybeSingle();
      if (!actuel?.present_le) {
        patch.present_le = new Date().toISOString();
      }
    } else if (live) {
      patch.present_le = null;
    }

    const { data, error } = await supabase
      .from(TABLES.participantsReunion)
      .update(patch)
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
