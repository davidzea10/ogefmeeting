import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ConfirmationsPresencePanel } from '@/components/reunions/ConfirmationsPresencePanel';
import { EnregistrementsSection } from '@/components/reunions/EnregistrementsSection';
import { ReunionStatusBadge } from '@/components/reunions/ReunionStatusBadge';
import { ReunionTabs, type TabId } from '@/components/reunions/ReunionTabs';
import { ReunionTimeline } from '@/components/reunions/ReunionTimeline';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { listerActions, listerDecisions } from '@/lib/actions-decisions-api';
import {
  formatDateHeure,
  formatDirectionsListe,
  LIBELLES_PARTICIPANT,
  LIBELLES_TYPE,
} from '@/lib/labels';
import { listerNotifications } from '@/lib/notifications-api';
import {
  archiverReunion,
  approuverReunion,
  cloturerReunion,
  creerCompteRendu,
  demarrerReunion,
  listerComptesRendusReunion,
  listerDirections,
  listerProfils,
  modifierParticipantStatut,
  modifierPointOrdreJour,
  obtenirReunion,
  refuserReunion,
} from '@/lib/reunions-api';
import { peutApprouverReunionRole, peutApprouverReunionPourReunion, peutGererReunionRole, peutModifierReunionRole, peutVoirArchivesMediaRole } from '@/lib/roles';
import { peutRejoindreLive } from '@/lib/invitation-live';
import { useAuthStore } from '@/stores/auth.store';
import {
  STATUTS_PARTICIPANT,
  type Profil,
  type StatutParticipant,
} from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Check,
  CheckSquare,
  Pencil,
  Play,
  Radio,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

export function ReunionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const announce = useAnnouncerStore((s) => s.announce);
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? s.profil?.id);
  const peutApprouver = peutApprouverReunionRole(role, profil?.fonction);
  const [tab, setTab] = useState<TabId>('informations');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (
      t === 'informations' ||
      t === 'participants' ||
      t === 'ordre-du-jour' ||
      t === 'enregistrement' ||
      t === 'compte-rendu' ||
      t === 'actions'
    ) {
      setTab(t);
    }
  }, [searchParams]);

  const reunionQuery = useQuery({
    queryKey: ['reunion', id],
    queryFn: () => obtenirReunion(id!),
    enabled: Boolean(id),
  });

  const peutGerer = peutGererReunionRole(
    role,
    profil?.fonction,
    userId,
    reunionQuery.data,
  );
  const profilsQuery = useQuery({
    queryKey: ['profils', 'detail'],
    queryFn: () => listerProfils({ limite: 100 }),
  });

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirections,
  });

  const alertesConfirmationsQuery = useQuery({
    queryKey: ['notifications', 'confirmations-reunion', id],
    queryFn: () => listerNotifications({ page: 1, limite: 50 }),
    enabled: Boolean(id) && Boolean(peutGerer),
  });

  const actionsQuery = useQuery({
    queryKey: ['actions-reunion', id],
    queryFn: () => listerActions({ reunion_id: id!, limite: 50 }),
    enabled: Boolean(id) && tab === 'actions',
  });

  const decisionsQuery = useQuery({
    queryKey: ['decisions-reunion', id],
    queryFn: () => listerDecisions({ reunion_id: id!, limite: 50 }),
    enabled: Boolean(id) && tab === 'actions',
  });

  const crQuery = useQuery({
    queryKey: ['comptes-rendus', id],
    queryFn: () => listerComptesRendusReunion(id!),
    enabled: Boolean(id) && (tab === 'compte-rendu' || Boolean(searchParams.get('cr'))),
  });

  const profilMap = useMemo(() => {
    const map = new Map<string, Profil>();
    for (const p of profilsQuery.data?.items ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [profilsQuery.data]);

  const alertesConfirmations = useMemo(() => {
    if (!id) return [];
    return (alertesConfirmationsQuery.data?.items ?? [])
      .filter(
        (n) =>
          n.type === 'invitation_repondue' &&
          (n.metadonnees as { reunion_id?: string } | null)?.reunion_id === id,
      )
      .sort(
        (a, b) =>
          new Date(b.cree_le).getTime() - new Date(a.cree_le).getTime(),
      );
  }, [alertesConfirmationsQuery.data, id]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reunion', id] });
    await queryClient.invalidateQueries({ queryKey: ['reunions'] });
  };

  const demarrerMut = useMutation({
    mutationFn: () => demarrerReunion(id!),
    onSuccess: async () => {
      announce('Réunion démarrée. Passage en mode live.');
      await invalidate();
      navigate(`/reunions/${id}/live`);
    },
    onError: (e: Error) => announce(e.message),
  });

  const cloturerMut = useMutation({
    mutationFn: async () => {
      const cloturee = await cloturerReunion(id!);
      const existants = await listerComptesRendusReunion(id!);
      if (existants.items.length === 0) {
        await creerCompteRendu(id!);
      }
      return cloturee;
    },
    onSuccess: async () => {
      announce('Réunion clôturée. Compte rendu brouillon prêt.');
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['comptes-rendus', id] });
      setTab('compte-rendu');
    },
    onError: (e: Error) => announce(e.message),
  });

  const archiverMut = useMutation({
    mutationFn: () => archiverReunion(id!),
    onSuccess: async () => {
      announce('Réunion archivée.');
      navigate('/reunions');
    },
    onError: (e: Error) => announce(e.message),
  });

  const approuverMut = useMutation({
    mutationFn: () => approuverReunion(id!),
    onSuccess: async () => {
      announce('Réunion validée et planifiée.');
      await invalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const refuserMut = useMutation({
    mutationFn: () => refuserReunion(id!),
    onSuccess: async () => {
      announce('Proposition de réunion refusée.');
      await invalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const pointMut = useMutation({
    mutationFn: ({ pointId, est_traite }: { pointId: string; est_traite: boolean }) =>
      modifierPointOrdreJour(id!, pointId, est_traite),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const participantMut = useMutation({
    mutationFn: ({
      participantId,
      statut,
    }: {
      participantId: string;
      statut: StatutParticipant;
    }) => modifierParticipantStatut(id!, participantId, statut),
    onSuccess: async () => {
      announce('Présence mise à jour.');
      await invalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  if (!id) {
    return <p className="text-danger">Identifiant manquant.</p>;
  }

  if (reunionQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-text-muted">
        Chargement de la réunion…
      </div>
    );
  }

  if (reunionQuery.isError || !reunionQuery.data) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-danger" role="alert">
        {reunionQuery.error instanceof Error
          ? reunionQuery.error.message
          : 'Réunion introuvable.'}
        <div className="mt-4">
          <Link to="/reunions">
            <Button variant="outline">Retour à la liste</Button>
          </Link>
        </div>
      </div>
    );
  }

  const reunion = reunionQuery.data;
  const directionIds =
    reunion.direction_ids ??
    (reunion.direction_id ? [reunion.direction_id] : []);
  const directionsLiees = (directionsQuery.data ?? []).filter((d) =>
    directionIds.includes(d.id),
  );
  const libelleDirections = formatDirectionsListe(directionsLiees, directionIds);
  const peutValiderIci = peutApprouverReunionPourReunion(
    role,
    profil?.fonction ?? null,
    profil?.direction_id,
    reunion,
  );
  const nomValidateur =
    reunion.valide_par_nom ??
    (reunion.valide_par
      ? (() => {
          const p = profilMap.get(reunion.valide_par);
          return p ? `${p.prenom} ${p.nom}`.trim() : null;
        })()
      : null);
  const points = [...reunion.points_ordre_jour].sort((a, b) => a.ordre - b.ordre);
  const traites = points.filter((p) => p.est_traite).length;
  const monInvitation = reunion.participants.find((p) => p.profil_id === userId);
  const invitationEnAttente =
    monInvitation?.statut === 'invite' &&
    reunion.statut !== 'cloturee' &&
    reunion.statut !== 'archivee';
  const montrerInvitationExpiree =
    Boolean(monInvitation) &&
    (reunion.statut === 'cloturee' || reunion.statut === 'archivee') &&
    monInvitation!.statut !== 'present';
  const reunionVerrouillee =
    reunion.statut === 'cloturee' || reunion.statut === 'archivee';
  const peutModifier =
    !reunionVerrouillee &&
    peutModifierReunionRole(role, profil?.fonction, userId, reunion);
  const estOrganisateur = Boolean(
    userId && reunion.cree_par && reunion.cree_par === userId,
  );
  const estAdmin = role === 'administrateur';
  /** Présences : organisateur (ou admin) en live ou après clôture. */
  const peutChangerPresence =
    (estOrganisateur || estAdmin) &&
    (reunion.statut === 'en_cours' ||
      reunion.statut === 'en_pause' ||
      reunion.statut === 'cloturee');
  const peutVoirArchives = peutVoirArchivesMediaRole(
    role,
    profil?.fonction,
    userId,
    reunion,
  );

  const tabs = [
    { id: 'informations' as const, label: 'Informations' },
    {
      id: 'participants' as const,
      label: 'Participants',
      count: reunion.participants.length,
    },
    {
      id: 'ordre-du-jour' as const,
      label: 'Ordre du jour',
      count: points.length,
    },
    { id: 'enregistrement' as const, label: 'Audio & texte' },
    {
      id: 'compte-rendu' as const,
      label: 'Compte rendu',
      count: crQuery.data?.pagination.total,
    },
    {
      id: 'actions' as const,
      label: 'Actions',
      count: actionsQuery.data?.pagination.total,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: reunion.titre },
        ]}
      />

      {/* En-tête */}
      <header className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ReunionStatusBadge statut={reunion.statut} />
              <Badge variant="neutral">{LIBELLES_TYPE[reunion.type_reunion]}</Badge>
            </div>
            <h2 className="text-2xl font-bold text-text sm:text-3xl">{reunion.titre}</h2>
            <p className="text-sm text-text-muted">
              {formatDateHeure(reunion.date_prevue)}
              {reunion.lieu ? ` · ${reunion.lieu}` : ''}
              {directionsLiees.length > 0 ? ` · ${libelleDirections}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Actions réunion">
            {reunion.statut === 'en_attente_validation' && peutValiderIci && (
              <>
                <Button
                  size="sm"
                  loading={approuverMut.isPending}
                  onClick={() => approuverMut.mutate()}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Valider / planifier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={refuserMut.isPending}
                  onClick={() => {
                    if (window.confirm('Refuser cette proposition de réunion ?')) {
                      refuserMut.mutate();
                    }
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Refuser
                </Button>
              </>
            )}
            {reunion.statut === 'en_attente_validation' &&
              peutApprouver &&
              !peutValiderIci && (
                <p className="text-sm text-text-muted">
                  {directionIds.length > 1
                    ? 'Validation réservée à un responsable d’une des directions concernées.'
                    : 'Vous ne pouvez pas valider cette réunion (direction différente).'}
                </p>
              )}
            {reunion.statut === 'en_attente_validation' && !peutApprouver && (
              <p className="text-sm text-ogefrem-navy/80">
                En attente de validation par un secrétaire, chef de service, sous-directeur ou directeur.
              </p>
            )}
            {reunion.statut === 'planifiee' && reunion.valide_par && (
              <p className="text-sm text-success">
                Validée{nomValidateur ? ` par ${nomValidateur}` : ''}
                {reunion.valide_le ? ` le ${formatDateHeure(reunion.valide_le)}` : ''}.
              </p>
            )}
            {peutModifier && (
              <Link to={`/reunions/${id}/modifier`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4" aria-hidden />
                  Modifier
                </Button>
              </Link>
            )}
            {peutGerer && reunion.statut === 'planifiee' && (
              <Button
                size="sm"
                loading={demarrerMut.isPending}
                onClick={() => demarrerMut.mutate()}
              >
                <Play className="h-4 w-4" aria-hidden />
                Démarrer
              </Button>
            )}
            {reunion.statut === 'en_cours' || reunion.statut === 'en_pause' ? (
              <>
                {peutRejoindreLive(reunion, userId, { estAdmin }) ? (
                  <Link to={`/reunions/${id}/live`}>
                    <Button size="sm">
                      <Radio className="h-4 w-4" aria-hidden />
                      {reunion.statut === 'en_pause' ? 'Reprendre le live' : 'Mode live'}
                    </Button>
                  </Link>
                ) : (
                  <Link to={`/reunions/${id}/invitation`}>
                    <Button size="sm">
                      Confirmer pour rejoindre le live
                    </Button>
                  </Link>
                )}
                {peutGerer && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={cloturerMut.isPending}
                    onClick={() => cloturerMut.mutate()}
                  >
                    <Square className="h-4 w-4" aria-hidden />
                    Clôturer
                  </Button>
                )}
              </>
            ) : null}
            {peutGerer &&
              reunion.statut !== 'archivee' &&
              reunion.statut !== 'en_cours' &&
              reunion.statut !== 'en_pause' && (
              <Button
                size="sm"
                variant="ghost"
                loading={archiverMut.isPending}
                onClick={() => {
                  if (window.confirm('Archiver cette réunion ?')) {
                    archiverMut.mutate();
                  }
                }}
              >
                <Archive className="h-4 w-4" aria-hidden />
                Archiver
              </Button>
            )}
          </div>
        </div>
      </header>

      {invitationEnAttente && (
        <div className="flex flex-col gap-3 rounded-xl border border-ogefrem-blue/25 bg-ogefrem-blue/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text">
            Vous êtes invité(e) à cette réunion. Confirmez votre participation.
          </p>
          <Link to={`/reunions/${id}/invitation`}>
            <Button size="sm">Confirmer l’invitation</Button>
          </Link>
        </div>
      )}

      {montrerInvitationExpiree && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text">
          Cette réunion a déjà eu lieu et est clôturée. Vous ne pouvez plus confirmer votre
          présence.
        </div>
      )}

      <ReunionTimeline reunion={reunion} />

      <ReunionTabs tabs={tabs} active={tab} onChange={setTab}>
        {tab === 'informations' && (
          <div className="space-y-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="Description" value={reunion.description || '—'} />
              <InfoItem label="Type" value={LIBELLES_TYPE[reunion.type_reunion]} />
              <InfoItem
                label={reunion.date_debut ? 'Date / heure de début' : 'Date prévue'}
                value={formatDateHeure(reunion.date_debut ?? reunion.date_prevue)}
              />
              <InfoItem label="Lieu" value={reunion.lieu || '—'} />
              <InfoItem
                label={directionIds.length > 1 ? 'Directions' : 'Direction'}
                value={libelleDirections}
              />
              <InfoItem
                label="Début réel"
                value={reunion.date_debut ? formatDateHeure(reunion.date_debut) : '—'}
              />
              <InfoItem
                label="Fin réelle"
                value={reunion.date_fin ? formatDateHeure(reunion.date_fin) : '—'}
              />
              <InfoItem
                label="Créée le"
                value={formatDateHeure(reunion.cree_le)}
              />
            </dl>

            <ConfirmationsPresencePanel
              participants={reunion.participants}
              profilMap={profilMap}
              alertes={alertesConfirmations}
              montrerAlertes={peutGerer}
            />
          </div>
        )}

        {tab === 'participants' && (
          <div className="space-y-3">
            {reunion.participants.length === 0 ? (
              <Empty hint="Aucun participant. Modifiez la réunion pour en ajouter." />
            ) : (
              <>
                {/* Mobile */}
                <ul className="space-y-2 md:hidden">
                  {reunion.participants.map((p) => {
                    const profil = profilMap.get(p.profil_id);
                    const nom = profil
                      ? `${profil.prenom} ${profil.nom}`
                      : `Profil ${p.profil_id.slice(0, 8)}…`;
                    return (
                      <li
                        key={p.id}
                        className="rounded-xl border border-border/80 bg-surface p-3 shadow-sm"
                      >
                        <p className="font-semibold text-text">{nom}</p>
                        <p className="text-xs text-text-muted">{profil?.email}</p>
                        <div className="mt-2">
                          {peutChangerPresence ? (
                            <select
                              className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                              value={p.statut}
                              disabled={participantMut.isPending}
                              onChange={(e) =>
                                participantMut.mutate({
                                  participantId: p.id,
                                  statut: e.target.value as StatutParticipant,
                                })
                              }
                              aria-label={`Statut de ${nom}`}
                            >
                              {(reunion.statut === 'cloturee'
                                ? (['present', 'absent'] as const)
                                : STATUTS_PARTICIPANT
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {LIBELLES_PARTICIPANT[s]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-flex rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-text-muted">
                              {LIBELLES_PARTICIPANT[p.statut]}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Desktop */}
                <div className="hidden overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gradient-to-r from-ogefrem-navy/[0.04] to-ogefrem-blue/[0.06]">
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Nom
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Email
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Présence
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {reunion.participants.map((p) => {
                        const profil = profilMap.get(p.profil_id);
                        const nom = profil
                          ? `${profil.prenom} ${profil.nom}`
                          : `Profil ${p.profil_id.slice(0, 8)}…`;
                        return (
                          <tr key={p.id} className="hover:bg-ogefrem-blue/[0.03]">
                            <td className="px-5 py-3 font-semibold text-text">{nom}</td>
                            <td className="px-4 py-3 text-text-muted">
                              {profil?.email ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              {peutChangerPresence ? (
                                <select
                                  className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                                  value={p.statut}
                                  disabled={participantMut.isPending}
                                  onChange={(e) =>
                                    participantMut.mutate({
                                      participantId: p.id,
                                      statut: e.target.value as StatutParticipant,
                                    })
                                  }
                                  aria-label={`Statut de ${nom}`}
                                >
                                  {(reunion.statut === 'cloturee'
                                    ? (['present', 'absent'] as const)
                                    : STATUTS_PARTICIPANT
                                  ).map((s) => (
                                    <option key={s} value={s}>
                                      {LIBELLES_PARTICIPANT[s]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-flex rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-text-muted">
                                  {LIBELLES_PARTICIPANT[p.statut]}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'ordre-du-jour' && (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              {traites}/{points.length} point{points.length > 1 ? 's' : ''} traité
              {traites > 1 ? 's' : ''}
              {!peutModifier ? ' · lecture seule' : ''}
            </p>
            {points.length === 0 ? (
              <Empty hint="Aucun point à l’ordre du jour." />
            ) : (
              <ul className="space-y-2">
                {points.map((point, index) => (
                  <li
                    key={point.id}
                    className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface p-3 shadow-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-ogefrem-blue disabled:opacity-50"
                      checked={point.est_traite}
                      disabled={!peutModifier || pointMut.isPending}
                      onChange={(e) =>
                        pointMut.mutate({
                          pointId: point.id,
                          est_traite: e.target.checked,
                        })
                      }
                      aria-label={`Marquer « ${point.titre} » comme traité`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          point.est_traite
                            ? 'font-semibold text-text-muted line-through'
                            : 'font-semibold text-text'
                        }
                      >
                        {index + 1}. {point.titre}
                      </p>
                      {point.description && (
                        <p className="text-sm text-text-muted">{point.description}</p>
                      )}
                      {point.duree_minutes && (
                        <p className="text-xs text-text-muted">{point.duree_minutes} min</p>
                      )}
                    </div>
                    {point.est_traite && (
                      <CheckSquare className="h-5 w-5 shrink-0 text-success" aria-hidden />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'enregistrement' && id && (
          <EnregistrementsSection
            reunionId={id}
            peutConsulter={peutVoirArchives}
            peutSupprimer={peutGerer}
          />
        )}

        {tab === 'compte-rendu' && (
          <div className="space-y-3">
            {searchParams.get('cr') && (
              <p
                className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                role="status"
              >
                Compte rendu brouillon prêt après clôture.
              </p>
            )}
            {crQuery.isLoading && <p className="text-text-muted">Chargement…</p>}
            {crQuery.isSuccess && (crQuery.data.items.length === 0 ? (
              <Empty hint="Aucun compte rendu pour cette réunion. Clôturez-la (mode live ou bouton Clôturer) pour créer un brouillon." />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {crQuery.data.items.map((cr) => (
                  <li key={cr.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/comptes-rendus/${cr.id}`}
                        className="font-semibold text-ogefrem-blue hover:underline"
                      >
                        Compte rendu · v{cr.version}
                      </Link>
                      <p className="text-xs text-text-muted">Statut : {cr.statut}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="neutral">{cr.statut}</Badge>
                      <Link to={`/comptes-rendus/${cr.id}`}>
                        <Button size="sm" variant="outline">
                          Ouvrir
                        </Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}

        {tab === 'actions' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text">
                Décisions ({decisionsQuery.data?.items.length ?? 0})
              </h3>
              {decisionsQuery.isLoading && <p className="text-text-muted">Chargement…</p>}
              {decisionsQuery.isSuccess && (decisionsQuery.data.items.length === 0 ? (
                <Empty hint="Aucune décision. Créez-en depuis le compte rendu." />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {decisionsQuery.data.items.map((d) => (
                    <li key={d.id} className="px-4 py-3">
                      <p className="font-semibold text-text">{d.titre}</p>
                      {d.description && (
                        <p className="mt-0.5 text-sm text-text-muted">{d.description}</p>
                      )}
                      {d.compte_rendu_id && (
                        <Link
                          to={`/comptes-rendus/${d.compte_rendu_id}`}
                          className="mt-1 inline-block text-xs font-semibold text-ogefrem-blue hover:underline"
                        >
                          Voir le CR lié
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text">
                Actions de suivi ({actionsQuery.data?.items.length ?? 0})
              </h3>
              {actionsQuery.isLoading && <p className="text-text-muted">Chargement…</p>}
              {actionsQuery.isSuccess && (actionsQuery.data.items.length === 0 ? (
                <Empty hint="Aucune action de suivi. Créez-en depuis le compte rendu." />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {actionsQuery.data.items.map((action) => {
                    const resp = action.responsable_id
                      ? profilMap.get(action.responsable_id)
                      : null;
                    return (
                      <li key={action.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-text">{action.titre}</p>
                          <Badge variant="neutral">{action.statut}</Badge>
                          <Badge variant="default">{action.priorite}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {resp ? `${resp.prenom} ${resp.nom}` : 'Non assigné'}
                          {action.date_echeance ? ` · échéance ${action.date_echeance}` : ''}
                        </p>
                        {action.compte_rendu_id && (
                          <Link
                            to={`/comptes-rendus/${action.compte_rendu_id}`}
                            className="mt-1 inline-block text-xs font-semibold text-ogefrem-blue hover:underline"
                          >
                            Voir le CR lié
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          </div>
        )}
      </ReunionTabs>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
      {hint}
    </p>
  );
}
