import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Logo } from '@/components/brand/Logo';
import { ReunionStatusBadge } from '@/components/reunions/ReunionStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useChronometre } from '@/hooks/useChronometre';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReunionRealtime } from '@/hooks/useReunionRealtime';
import { formatDateHeure, LIBELLES_PARTICIPANT, LIBELLES_TYPE } from '@/lib/labels';
import {
  appliquerPresenceLocale,
  trierParticipantsLive,
  type TriPresenceLive,
} from '@/lib/live-presence';
import { isRealtimeConfigured } from '@/lib/supabase-browser';
import { easeOutExpo, useMotionSafe } from '@/lib/motion';
import { EnregistrementLivePanel, type EnregistrementLivePanelHandle } from '@/components/reunions/EnregistrementLivePanel';
import { LiveOrdreJourPanel } from '@/components/reunions/LiveOrdreJourPanel';
import { TranscriptionLivePanel, type TranscriptionLivePanelHandle } from '@/components/reunions/TranscriptionLivePanel';
import {
  annulerLiveReunion,
  cloturerReunion,
  creerCompteRendu,
  listerComptesRendusReunion,
  listerProfils,
  mettreReunionEnPause,
  modifierParticipantStatut,
  obtenirReunion,
  rejoindreLiveReunion,
  reprendreReunion,
} from '@/lib/reunions-api';
import { peutGererReunionRole, peutModifierReunionRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import {
  STATUTS_PARTICIPANT,
  type Profil,
  type StatutParticipant,
} from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Crown,
  Pause,
  Play,
  Radio,
  Square,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export function ReunionLivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const announce = useAnnouncerStore((s) => s.announce);
  const profil = useAuthStore((s) => s.profil);
  const profilId = profil?.id;
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const userId = profilId ?? useAuthStore((s) => s.user?.id);
  const motionSafe = useMotionSafe();
  const [showCloture, setShowCloture] = useState(false);
  const [showAnnuler, setShowAnnuler] = useState(false);
  const [triPresence, setTriPresence] = useState<TriPresenceLive>('arrivee');
  const [filtrePresentsSeulement, setFiltrePresentsSeulement] = useState(false);
  const etaitEnLiveRef = useRef(false);
  const tentativesRejoindreRef = useRef(0);
  const presenceServeurOkRef = useRef(false);
  const audioPanelRef = useRef<EnregistrementLivePanelHandle>(null);
  const transcriptionPanelRef = useRef<TranscriptionLivePanelHandle>(null);

  useReunionRealtime(id);

  const reunionQuery = useQuery({
    queryKey: ['reunion', id],
    queryFn: () => obtenirReunion(id!),
    enabled: Boolean(id),
    /** Sync pause / présences / clôture même si Realtime Supabase indisponible. */
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const profilsQuery = useQuery({
    queryKey: ['profils', 'live'],
    queryFn: () => listerProfils({ limite: 100 }),
  });

  const profilMap = useMemo(() => {
    const map = new Map<string, Profil>();
    for (const p of profilsQuery.data?.items ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [profilsQuery.data]);

  const reunion = reunionQuery.data;
  const enPause = reunion?.statut === 'en_pause';
  const chrono = useChronometre(
    reunion?.statut === 'en_cours' || reunion?.statut === 'en_pause'
      ? reunion.date_debut
      : null,
    enPause,
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reunion', id] });
    await queryClient.invalidateQueries({ queryKey: ['reunions'] });
  };

  /** Entrée live → présence automatique (invite/confirme → présent). */
  const rejoindreMut = useMutation({
    mutationFn: () => rejoindreLiveReunion(id!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['reunion', id] });
      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof obtenirReunion>>>([
        'reunion',
        id,
      ]);
      if (previous && userId) {
        queryClient.setQueryData(['reunion', id], {
          ...previous,
          participants: previous.participants.map((p) =>
            p.profil_id === userId ? { ...p, statut: 'present' as const } : p,
          ),
        });
      }
      return { previous };
    },
    onSuccess: (participant) => {
      presenceServeurOkRef.current = true;
      tentativesRejoindreRef.current = 0;
      queryClient.setQueryData<Awaited<ReturnType<typeof obtenirReunion>>>(
        ['reunion', id],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            participants: old.participants.map((p) =>
              p.id === participant.id ? participant : p,
            ),
          };
        },
      );
      void invalidate();
    },
    onError: (e: Error) => {
      announce(e.message || 'Impossible de marquer votre présence.');
      // On garde l’affichage optimiste « présent » pour l’utilisateur connecté.
    },
  });

  useEffect(() => {
    presenceServeurOkRef.current = false;
    tentativesRejoindreRef.current = 0;
    etaitEnLiveRef.current = false;
  }, [id]);

  /** Si le serveur indique déjà « présent », pas besoin de rappeler l’API. */
  useEffect(() => {
    if (!reunion || !userId) return;
    const moi = reunion.participants.find((p) => p.profil_id === userId);
    if (moi?.statut === 'present' && moi.present_le) {
      presenceServeurOkRef.current = true;
    }
  }, [reunion, userId]);

  /** Marque la présence dès l’entrée live, avec nouvelles tentatives si l’API échoue. */
  useEffect(() => {
    if (!id || !userId || !reunion) return;
    if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') return;
    if (presenceServeurOkRef.current) return;

    const moi = reunion.participants.find((p) => p.profil_id === userId);
    if (!moi) return;
    if (rejoindreMut.isPending) return;
    if (tentativesRejoindreRef.current >= 8) return;

    const delai = tentativesRejoindreRef.current === 0 ? 0 : 2500;
    const timer = window.setTimeout(() => {
      tentativesRejoindreRef.current += 1;
      rejoindreMut.mutate();
    }, delai);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry contrôlé par tentativesRejoindreRef
  }, [id, userId, reunion?.statut, reunion?.participants, rejoindreMut.isPending]);

  /** Clôture / annulation par l’organisateur → redirection synchronisée pour tous. */
  useEffect(() => {
    if (!reunion || !id) return;

    if (reunion.statut === 'en_cours' || reunion.statut === 'en_pause') {
      etaitEnLiveRef.current = true;
      return;
    }

    if (!etaitEnLiveRef.current) return;

    audioPanelRef.current?.abandonner();
    transcriptionPanelRef.current?.abandonner();

    if (reunion.statut === 'cloturee') {
      announce('La réunion a été clôturée.');
      navigate(`/reunions/${id}`, { replace: true });
      return;
    }

    if (reunion.statut === 'planifiee') {
      announce('Le live a été annulé par l’organisateur.');
      navigate(`/reunions/${id}`, { replace: true });
      return;
    }

    if (reunion.statut === 'archivee') {
      announce('Le test live a été annulé.');
      navigate('/teste-live', { replace: true });
    }
  }, [reunion?.statut, id, navigate, announce, reunion]);

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

  const cloturerMut = useMutation({
    mutationFn: async () => {
      await audioPanelRef.current?.preparerCloture().catch((e: Error) => {
        announce(`Audio : ${e.message}`);
      });
      await transcriptionPanelRef.current?.preparerCloture().catch((e: Error) => {
        throw new Error(`Transcription : ${e.message}`);
      });
      const cloturee = await cloturerReunion(id!);
      const existants = await listerComptesRendusReunion(id!);
      let crId = existants.items[0]?.id;
      if (!crId) {
        const cr = await creerCompteRendu(id!, profilId ?? null);
        crId = cr.id;
      }
      return { reunion: cloturee, crId };
    },
    onSuccess: async ({ crId }) => {
      announce('Réunion clôturée. Compte rendu brouillon prêt.');
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['comptes-rendus', id] });
      setShowCloture(false);
      navigate(`/reunions/${id}?tab=compte-rendu&cr=${crId}`);
    },
    onError: (e: Error) => announce(e.message),
  });

  const pauseMut = useMutation({
    mutationFn: () => mettreReunionEnPause(id!),
    onSuccess: async () => {
      announce('Réunion mise en pause.');
      await invalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const reprendreMut = useMutation({
    mutationFn: () => reprendreReunion(id!),
    onSuccess: async () => {
      announce('Réunion reprise.');
      await invalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const annulerMut = useMutation({
    mutationFn: async () => {
      audioPanelRef.current?.abandonner();
      transcriptionPanelRef.current?.abandonner();
      return annulerLiveReunion(id!);
    },
    onSuccess: async (reunionAnnulee) => {
      const estTest = reunionAnnulee.titre.trim().startsWith('[TEST LIVE]');
      announce(
        estTest
          ? 'Test live annulé — rien n’a été conservé.'
          : 'Live annulé — retour à la planification. Rien n’a été enregistré.',
      );
      setShowAnnuler(false);
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['enregistrements', id] });
      await queryClient.invalidateQueries({ queryKey: ['comptes-rendus', id] });
      if (estTest) {
        navigate('/teste-live', { replace: true });
      } else {
        navigate(`/reunions/${id}`, { replace: true });
      }
    },
    onError: (e: Error) => announce(e.message),
  });

  if (!id) {
    return <p className="p-8 text-danger">Identifiant manquant.</p>;
  }

  if (reunionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ogefrem-navy text-white/80">
        Chargement du mode live…
      </div>
    );
  }

  if (reunionQuery.isError || !reunion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-8">
        <p className="text-danger" role="alert">
          {reunionQuery.error instanceof Error
            ? reunionQuery.error.message
            : 'Réunion introuvable.'}
        </p>
        <Link to="/reunions">
          <Button variant="outline">Retour aux réunions</Button>
        </Link>
      </div>
    );
  }

  if (reunion.statut !== 'en_cours' && reunion.statut !== 'en_pause') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted p-8 text-center">
        <ReunionStatusBadge statut={reunion.statut} />
        <h1 className="text-xl font-bold text-text">{reunion.titre}</h1>
        <p className="max-w-md text-sm text-text-muted">
          {reunion.statut === 'cloturee'
            ? 'Cette réunion est clôturée. Consultez le détail, l’audio et la transcription (admin / organisateur).'
            : 'Le mode live est disponible uniquement pour une réunion en cours ou en pause.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to={`/reunions/${id}`}>
            <Button>Voir le détail</Button>
          </Link>
          <Link to="/reunions">
            <Button variant="outline">Liste des réunions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const points = [...reunion.points_ordre_jour].sort((a, b) => a.ordre - b.ordre);
  const traites = points.filter((p) => p.est_traite).length;
  const progress = points.length === 0 ? 0 : Math.round((traites / points.length) * 100);
  const peutModifier = peutModifierReunionRole(role, profil?.fonction, userId, reunion);
  const peutGerer = peutGererReunionRole(role, profil?.fonction, userId, reunion);
  /** Organisateur ou ayant-droit : conduire, clôturer, enregistrer. */
  const peutConduireLive = peutGerer || peutModifier;
  const estOrganisateur = Boolean(userId && reunion.cree_par && reunion.cree_par === userId);
  const estAdmin = role === 'administrateur';
  /** Seul l’organisateur (ou admin) peut changer les présences manuellement. */
  const peutChangerPresence = estOrganisateur || estAdmin;
  /** Invité simple : voit le live sans modifier ni clôturer. */
  const estInviteLectureSeule = !peutConduireLive;

  const nomParticipant = (pid: string) => {
    const profilP = profilMap.get(pid);
    return profilP
      ? `${profilP.prenom} ${profilP.nom}`
      : `Profil ${pid.slice(0, 8)}…`;
  };

  const enLive = reunion.statut === 'en_cours' || reunion.statut === 'en_pause';
  const participantsAvecPresenceLocale = appliquerPresenceLocale(
    reunion.participants,
    userId,
    enLive,
  );
  const participantsTries = trierParticipantsLive(
    participantsAvecPresenceLocale,
    reunion,
    triPresence,
    nomParticipant,
  );
  const participantsAffiches = filtrePresentsSeulement
    ? participantsTries.filter((p) => p.statut === 'present')
    : participantsTries;
  const presents = participantsAvecPresenceLocale.filter((p) => p.statut === 'present').length;

  return (
    <div className="relative flex min-h-screen flex-col bg-ogefrem-navy text-white">
      {enPause && (
        <div
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-ogefrem-navy/75 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-warning/40 bg-warning/15 px-8 py-6 text-center shadow-xl">
            <Pause className="mx-auto h-12 w-12 text-warning" aria-hidden />
            <p className="mt-3 text-xl font-bold text-white">Réunion en pause</p>
            <p className="mt-1 text-sm text-white/75">
              {peutConduireLive
                ? 'Reprenez quand vous êtes prêt(e).'
                : 'En attente de reprise par l’organisateur…'}
            </p>
          </div>
        </div>
      )}
      {/* Barre focus */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ogefrem-navy/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={`/reunions/${id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ogefrem-yellow"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {estInviteLectureSeule ? 'Quitter la réunion' : 'Quitter le live'}
            </Link>
            <div className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden />
            <Logo size="sm" className="hidden sm:flex" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                    enPause ? 'bg-warning/90 text-ogefrem-navy' : 'bg-danger/90'
                  }`}
                >
                  {enPause ? (
                    <>
                      <Pause className="h-3 w-3" aria-hidden />
                      Pause
                    </>
                  ) : (
                    <>
                      <Radio className="h-3 w-3 animate-pulse" aria-hidden />
                      Live
                    </>
                  )}
                </span>
                <Badge variant="neutral" className="!bg-white/10 !text-white">
                  {LIBELLES_TYPE[reunion.type_reunion]}
                </Badge>
                {isRealtimeConfigured() ? (
                  <span className="text-xs text-white/50">Temps réel</span>
                ) : (
                  <span className="text-xs text-white/50">Sync 2s</span>
                )}
              </div>
              <h1 className="truncate text-base font-semibold sm:text-lg">{reunion.titre}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="rounded-xl bg-ogefrem-yellow px-4 py-2 text-center text-ogefrem-navy shadow-md"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                Chronomètre
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums leading-none sm:text-3xl">
                {chrono.label}
              </p>
            </div>
            {peutConduireLive && (
              <>
                {enPause ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="!bg-ogefrem-yellow !text-ogefrem-navy hover:!bg-ogefrem-yellow/90"
                    loading={reprendreMut.isPending}
                    onClick={() => reprendreMut.mutate()}
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    Reprendre
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="!bg-white/15 !text-white hover:!bg-white/25"
                    loading={pauseMut.isPending}
                    onClick={() => pauseMut.mutate()}
                  >
                    <Pause className="h-4 w-4" aria-hidden />
                    Pause
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="!bg-white/10 !text-white hover:!bg-white/20"
                  onClick={() => setShowAnnuler(true)}
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Annuler le live
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="!bg-white !text-ogefrem-navy hover:!bg-white/90"
                  onClick={() => setShowCloture(true)}
                >
                  <Square className="h-4 w-4" aria-hidden />
                  Clôturer
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progression ODJ */}
        <div className="h-1.5 w-full bg-white/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de l’ordre du jour">
          <motion.div
            className="h-full bg-ogefrem-yellow"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={motionSafe ? { duration: 0.35, ease: easeOutExpo } : { duration: 0 }}
          />
        </div>
      </header>

      {estInviteLectureSeule && (
        <div
          className="border-b border-ogefrem-yellow/30 bg-ogefrem-yellow/15 px-4 py-2 text-center text-sm text-ogefrem-yellow"
          role="status"
        >
          Mode participant — lecture seule. Vous pouvez quitter cette page ;
          seuls l’organisateur et les ayant-droit peuvent mettre en pause ou clôturer.
        </div>
      )}

      {peutConduireLive && !estOrganisateur && (
        <div
          className="border-b border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-white/80"
          role="status"
        >
          Mode ayant-droit — vous pouvez quitter le live, l’annuler (sans enregistrement)
          ou clôturer la réunion.
        </div>
      )}

      <main
        id="contenu-principal"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6"
      >
        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start">
          {/* Colonne gauche — conduite de réunion */}
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-sm text-white/60">
              Démarrée {reunion.date_debut ? formatDateHeure(reunion.date_debut) : '—'}
              {reunion.lieu ? ` · ${reunion.lieu}` : ''}
              {' · '}
              {traites}/{points.length} point{points.length > 1 ? 's' : ''} traité
              {traites > 1 ? 's' : ''}
              {' · '}
              {presents}/{reunion.participants.length} présent
              {presents > 1 ? 's' : ''}
            </p>

            <LiveOrdreJourPanel
              reunionId={id}
              points={points}
              peutModifier={peutModifier}
              onInvalidate={invalidate}
              announce={announce}
            />

            <section aria-labelledby="live-participants-title" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="live-participants-title"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Users className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
                  Présences
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-white/70">
                    <span className="sr-only">Tri des présences</span>
                    <select
                      value={triPresence}
                      onChange={(e) => setTriPresence(e.target.value as TriPresenceLive)}
                      className="h-8 rounded-lg border border-white/20 bg-ogefrem-navy px-2 text-xs text-white"
                      aria-label="Tri des présences"
                    >
                      <option value="arrivee">Ordre d&apos;arrivée</option>
                      <option value="statut">Par statut</option>
                      <option value="alphabetique">Alphabétique</option>
                    </select>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs text-white/80">
                    <input
                      type="checkbox"
                      checked={filtrePresentsSeulement}
                      onChange={(e) => setFiltrePresentsSeulement(e.target.checked)}
                      className="rounded border-white/30"
                    />
                    Présents seulement
                  </label>
                </div>
              </div>
              {reunion.participants.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/20 p-6 text-center text-white/60">
                  Aucun participant.
                </p>
              ) : participantsAffiches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/20 p-6 text-center text-white/60">
                  Aucun participant présent pour le moment.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {participantsAffiches.map((p) => {
                    const nom = nomParticipant(p.profil_id);
                    const estOrg = Boolean(
                      reunion.cree_par && p.profil_id === reunion.cree_par,
                    );
                    const estMoi = Boolean(userId && p.profil_id === userId);
                    const estPresent = p.statut === 'present';
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition ${
                          estOrg
                            ? 'border-ogefrem-yellow/50 bg-ogefrem-yellow/10'
                            : estPresent
                              ? 'border-success/35 bg-success/10'
                              : 'border-white/15 bg-white/5'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {estPresent && (
                            <span
                              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success"
                              aria-hidden
                              title="Présent en live"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium">{nom}</span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {estOrg && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-ogefrem-yellow/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ogefrem-yellow">
                                  <Crown className="h-3 w-3" aria-hidden />
                                  Organisateur
                                </span>
                              )}
                              {estMoi && (
                                <span className="text-[10px] font-semibold uppercase text-white/50">
                                  Vous
                                </span>
                              )}
                              {estPresent && p.present_le && (
                                <span className="text-[10px] text-white/45">
                                  Entré {formatDateHeure(p.present_le)}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        {peutChangerPresence ? (
                          <select
                            className="h-9 shrink-0 rounded-lg border border-white/20 bg-ogefrem-navy px-2 text-xs text-white disabled:opacity-50"
                            value={p.statut}
                            disabled={participantMut.isPending}
                            onChange={(e) =>
                              participantMut.mutate({
                                participantId: p.id,
                                statut: e.target.value as StatutParticipant,
                              })
                            }
                            aria-label={`Présence de ${nom}`}
                          >
                            {STATUTS_PARTICIPANT.map((s) => (
                              <option key={s} value={s}>
                                {LIBELLES_PARTICIPANT[s]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`shrink-0 rounded-md px-2 py-1 text-xs ${
                              estPresent
                                ? 'bg-success/20 font-semibold text-success'
                                : 'bg-white/10 text-white/80'
                            }`}
                          >
                            {LIBELLES_PARTICIPANT[p.statut]}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <EnregistrementLivePanel
              ref={audioPanelRef}
              reunionId={id}
              peutEnregistrer={peutConduireLive}
              reunionEnPause={enPause}
            />
          </div>

          {/* Colonne droite — transcription live */}
          <div className="lg:sticky lg:top-[5.5rem]">
            <TranscriptionLivePanel
              ref={transcriptionPanelRef}
              reunionId={id}
              peutControle={peutConduireLive}
              desactive={enPause}
            />
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showCloture && (
          <ClotureModal
            titre={reunion.titre}
            dureeLabel={chrono.label}
            traites={traites}
            totalPoints={points.length}
            presents={presents}
            totalParticipants={reunion.participants.length}
            loading={cloturerMut.isPending}
            onCancel={() => setShowCloture(false)}
            onConfirm={() => cloturerMut.mutate()}
          />
        )}
        {showAnnuler && (
          <AnnulerLiveModal
            titre={reunion.titre}
            estTest={reunion.titre.trim().startsWith('[TEST LIVE]')}
            loading={annulerMut.isPending}
            onCancel={() => setShowAnnuler(false)}
            onConfirm={() => annulerMut.mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ClotureModal({
  titre,
  dureeLabel,
  traites,
  totalPoints,
  presents,
  totalParticipants,
  loading,
  onCancel,
  onConfirm,
}: {
  titre: string;
  dureeLabel: string;
  traites: number;
  totalPoints: number;
  presents: number;
  totalParticipants: number;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const trapRef = useFocusTrap(true, onCancel);
  const motionSafe = useMotionSafe();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      initial={motionSafe ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={motionSafe ? { opacity: 0 } : undefined}
      role="presentation"
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloture-title"
        className="w-full max-w-md rounded-2xl bg-surface p-6 text-text shadow-lg"
        initial={motionSafe ? { opacity: 0, y: 24 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={motionSafe ? { opacity: 0, y: 16 } : undefined}
        transition={{ duration: 0.28, ease: easeOutExpo }}
      >
        <h2 id="cloture-title" className="text-xl font-bold text-text">
          Clôturer la réunion ?
        </h2>
        <p className="mt-1 text-sm text-text-muted">{titre}</p>

        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase text-text-muted">Durée</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">{dureeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-text-muted">Points traités</dt>
            <dd className="mt-0.5 text-lg font-bold">
              {traites}/{totalPoints}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase text-text-muted">Présents</dt>
            <dd className="mt-0.5 text-lg font-bold">
              {presents}/{totalParticipants}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-text-muted">
          L’audio et la transcription seront sauvegardés avant clôture. Un compte rendu brouillon
          sera créé (ou réutilisé) et vous serez redirigé vers l’onglet compte rendu.
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button loading={loading} onClick={onConfirm}>
            Confirmer la clôture
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AnnulerLiveModal({
  titre,
  estTest,
  loading,
  onCancel,
  onConfirm,
}: {
  titre: string;
  estTest: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const trapRef = useFocusTrap(true, onCancel);
  const motionSafe = useMotionSafe();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      initial={motionSafe ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={motionSafe ? { opacity: 0 } : undefined}
      role="presentation"
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="annuler-live-title"
        className="w-full max-w-md rounded-2xl bg-surface p-6 text-text shadow-lg"
        initial={motionSafe ? { opacity: 0, y: 24 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={motionSafe ? { opacity: 0, y: 16 } : undefined}
        transition={{ duration: 0.28, ease: easeOutExpo }}
      >
        <h2 id="annuler-live-title" className="text-xl font-bold text-text">
          Annuler le live ?
        </h2>
        <p className="mt-1 text-sm text-text-muted">{titre}</p>

        <p className="mt-4 text-sm text-text-muted">
          {estTest
            ? 'Le test sera annulé et archivé. Aucun audio, aucune transcription ni compte rendu ne sera conservé.'
            : 'La réunion reviendra à l’état planifié. Aucun audio, aucune transcription ni compte rendu ne sera conservé.'}
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Continuer le live
          </Button>
          <Button
            variant="secondary"
            className="!bg-danger !text-white hover:!bg-danger/90"
            loading={loading}
            onClick={onConfirm}
          >
            Confirmer l’annulation
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
