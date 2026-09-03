import { Button } from '@/components/ui/Button';
import { formatDateHeure } from '@/lib/labels';
import { monStatutParticipant, statutAutoriseLive } from '@/lib/invitation-live';
import type { ReunionDetail } from '@ogefmeeting/shared';
import { MapPin, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  reunion: ReunionDetail;
  profilId?: string | null;
};

/**
 * Bannière prioritaire : une réunion en cours où l’utilisateur est invité.
 */
export function ReunionLiveJoinBanner({ reunion, profilId }: Props) {
  const moi = monStatutParticipant(reunion, profilId);
  const peutLive = statutAutoriseLive(moi?.statut) || reunion.cree_par === profilId;
  const doitConfirmer = moi?.statut === 'invite' || moi?.statut === 'absent';

  return (
    <section
      aria-label="Réunion en cours — rejoindre"
      className="relative overflow-hidden rounded-2xl border-2 border-ogefrem-yellow/60 bg-ogefrem-navy text-white shadow-xl"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse at top right, rgba(255,199,44,0.35), transparent 55%), radial-gradient(ellipse at bottom left, rgba(0,102,179,0.5), transparent 50%)',
        }}
      />
      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ogefrem-yellow">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden />
            {reunion.statut === 'en_pause' ? 'Réunion en pause' : 'Réunion en cours'}
          </p>
          <h3 className="text-2xl font-bold leading-snug sm:text-3xl md:text-4xl">
            Veuillez rejoindre la réunion
          </h3>
          <p className="text-lg font-semibold text-white/95 sm:text-xl">{reunion.titre}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
            <span>{formatDateHeure(reunion.date_debut ?? reunion.date_prevue)}</span>
            {reunion.lieu ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {reunion.lieu}
              </span>
            ) : null}
          </p>
          {doitConfirmer ? (
            <p className="text-sm text-ogefrem-yellow/95">
              Confirmez d’abord votre invitation pour accéder au live.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {peutLive ? (
            <Link to={`/reunions/${reunion.id}/live`}>
              <Button
                size="lg"
                className="bg-ogefrem-yellow text-ogefrem-navy hover:bg-ogefrem-yellow-light"
              >
                <Radio className="h-5 w-5" aria-hidden />
                Rejoindre le live
              </Button>
            </Link>
          ) : (
            <Link to={`/reunions/${reunion.id}/invitation`}>
              <Button
                size="lg"
                className="bg-ogefrem-yellow text-ogefrem-navy hover:bg-ogefrem-yellow-light"
              >
                Confirmer puis rejoindre
              </Button>
            </Link>
          )}
          <Link to={`/reunions/${reunion.id}`}>
            <Button
              size="sm"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              Voir le détail
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
