import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Logo } from '@/components/brand/Logo';
import { ReunionStatusBadge } from '@/components/reunions/ReunionStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useChronometre } from '@/hooks/useChronometre';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReunionRealtime } from '@/hooks/useReunionRealtime';
import { formatDateHeure, LIBELLES_PARTICIPANT, LIBELLES_TYPE } from '@/lib/labels';
import { isRealtimeConfigured } from '@/lib/supabase-browser';
import { easeOutExpo, useMotionSafe } from '@/lib/motion';
import {
  cloturerReunion,
  creerCompteRendu,
  listerComptesRendusReunion,
  listerProfils,
  modifierParticipantStatut,
  modifierPointOrdreJour,
  obtenirReunion,
} from '@/lib/reunions-api';
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
  CheckSquare,
  Radio,
  Square,
  Users,
} from 'lucide-react';
import { useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export function ReunionLivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const announce = useAnnouncerStore((s) => s.announce);
  const profilId = useAuthStore((s) => s.profil?.id);
  const motionSafe = useMotionSafe();
  const [showCloture, setShowCloture] = useState(false);

  useReunionRealtime(id);

  const reunionQuery = useQuery({
    queryKey: ['reunion', id],
    queryFn: () => obtenirReunion(id!),
    enabled: Boolean(id),
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
  const chrono = useChronometre(
    reunion?.statut === 'en_cours' ? reunion.date_debut : null,
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reunion', id] });
    await queryClient.invalidateQueries({ queryKey: ['reunions'] });
  };

  const pointMut = useMutation({
    mutationFn: ({ pointId, est_traite }: { pointId: string; est_traite: boolean }) =>
      modifierPointOrdreJour(id!, pointId, est_traite),
    onSuccess: async (_, vars) => {
      announce(vars.est_traite ? 'Point traité.' : 'Point rouvert.');
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

  const cloturerMut = useMutation({
    mutationFn: async () => {
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

  if (reunion.statut !== 'en_cours') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted p-8 text-center">
        <ReunionStatusBadge statut={reunion.statut} />
        <h1 className="text-xl font-bold text-text">{reunion.titre}</h1>
        <p className="max-w-md text-sm text-text-muted">
          {reunion.statut === 'cloturee'
            ? 'Cette réunion est clôturée. Consultez le détail ou le compte rendu.'
            : 'Le mode live est disponible uniquement pour une réunion en cours.'}
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
  const presents = reunion.participants.filter((p) => p.statut === 'present').length;
  const progress = points.length === 0 ? 0 : Math.round((traites / points.length) * 100);

  return (
    <div className="flex min-h-screen flex-col bg-ogefrem-navy text-white">
      {/* Barre focus */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ogefrem-navy/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={`/reunions/${id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-ogefrem-yellow"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Quitter
            </Link>
            <div className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden />
            <Logo size="sm" className="hidden sm:flex" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/90 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
                  <Radio className="h-3 w-3 animate-pulse" aria-hidden />
                  Live
                </span>
                <Badge variant="neutral" className="!bg-white/10 !text-white">
                  {LIBELLES_TYPE[reunion.type_reunion]}
                </Badge>
                {isRealtimeConfigured() ? (
                  <span className="text-xs text-white/50">Temps réel</span>
                ) : (
                  <span className="text-xs text-white/50">Sync 8s</span>
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
            <Button
              variant="secondary"
              size="sm"
              className="!bg-white !text-ogefrem-navy hover:!bg-white/90"
              onClick={() => setShowCloture(true)}
            >
              <Square className="h-4 w-4" aria-hidden />
              Clôturer
            </Button>
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

      <main
        id="contenu-principal"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6"
      >
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

        <section aria-labelledby="live-odj-title" className="space-y-3">
          <h2 id="live-odj-title" className="flex items-center gap-2 text-lg font-semibold">
            <CheckSquare className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
            Ordre du jour
          </h2>
          {points.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/20 p-8 text-center text-white/60">
              Aucun point à l’ordre du jour.
            </p>
          ) : (
            <ul className="space-y-2">
              {points.map((point, index) => (
                <li key={point.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      point.est_traite
                        ? 'border-success/40 bg-success/15'
                        : 'border-white/15 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-ogefrem-yellow"
                      checked={point.est_traite}
                      disabled={pointMut.isPending}
                      onChange={(e) =>
                        pointMut.mutate({
                          pointId: point.id,
                          est_traite: e.target.checked,
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block font-semibold ${
                          point.est_traite ? 'text-white/50 line-through' : 'text-white'
                        }`}
                      >
                        {index + 1}. {point.titre}
                      </span>
                      {point.description && (
                        <span className="mt-0.5 block text-sm text-white/55">
                          {point.description}
                        </span>
                      )}
                      {point.duree_minutes != null && (
                        <span className="mt-1 block text-xs text-white/40">
                          {point.duree_minutes} min prévues
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="live-participants-title" className="space-y-3">
          <h2 id="live-participants-title" className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
            Présences
          </h2>
          {reunion.participants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/20 p-6 text-center text-white/60">
              Aucun participant.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {reunion.participants.map((p) => {
                const profil = profilMap.get(p.profil_id);
                const nom = profil
                  ? `${profil.prenom} ${profil.nom}`
                  : `Profil ${p.profil_id.slice(0, 8)}…`;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{nom}</span>
                    <select
                      className="h-9 shrink-0 rounded-lg border border-white/20 bg-ogefrem-navy px-2 text-xs text-white"
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
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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
          Un compte rendu brouillon sera créé (ou réutilisé) et vous serez redirigé vers
          l’onglet compte rendu.
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
