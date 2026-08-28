import { Badge } from '@/components/ui/Badge';
import { formatDateHeure, LIBELLES_PARTICIPANT } from '@/lib/labels';
import type { NotificationApp, ParticipantReunion, Profil, StatutParticipant } from '@ogefmeeting/shared';
import { Bell, CheckCircle2, UserX, Users } from 'lucide-react';

type Props = {
  participants: ParticipantReunion[];
  profilMap: Map<string, Profil>;
  /** Alertes « invitation_repondue » liées à cette réunion (organisateur). */
  alertes?: NotificationApp[];
  /** Affiche le panneau d’alertes (organisateur / ayant-droit). */
  montrerAlertes?: boolean;
};

function compter(participants: ParticipantReunion[]) {
  const total = participants.length;
  let confirmes = 0;
  let presents = 0;
  let absents = 0;
  let enAttente = 0;
  for (const p of participants) {
    if (p.statut === 'present') presents += 1;
    else if (p.statut === 'confirme') confirmes += 1;
    else if (p.statut === 'absent') absents += 1;
    else enAttente += 1;
  }
  return { total, confirmes, presents, absents, enAttente };
}

export function ConfirmationsPresencePanel({
  participants,
  profilMap,
  alertes = [],
  montrerAlertes = false,
}: Props) {
  const stats = compter(participants);
  const repondu = stats.confirmes + stats.presents + stats.absents;

  const lignes = [...participants].sort((a, b) => {
    const ordre: Record<StatutParticipant, number> = {
      present: 0,
      confirme: 1,
      invite: 2,
      absent: 3,
    };
    return (ordre[a.statut] ?? 9) - (ordre[b.statut] ?? 9);
  });

  return (
    <section
      aria-labelledby="confirmations-presence-title"
      className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="confirmations-presence-title"
            className="flex items-center gap-2 text-base font-semibold text-text"
          >
            <Users className="h-5 w-5 text-ogefrem-blue" aria-hidden />
            Confirmations de présence
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {repondu}/{stats.total} participant{stats.total > 1 ? 's' : ''} ont
            répondu
            {stats.confirmes + stats.presents > 0
              ? ` · ${stats.confirmes + stats.presents} confirmé${stats.confirmes + stats.presents > 1 ? 's' : ''}`
              : ''}
            {stats.enAttente > 0 ? ` · ${stats.enAttente} en attente` : ''}
            {stats.absents > 0 ? ` · ${stats.absents} absent${stats.absents > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutral">{stats.confirmes + stats.presents} confirmés</Badge>
          <Badge variant="neutral">{stats.enAttente} en attente</Badge>
          <Badge variant="neutral">{stats.absents} absents</Badge>
          {stats.presents > 0 && (
            <Badge variant="success">{stats.presents} présents (live)</Badge>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/80">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60">
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Participant
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Statut
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {lignes.map((p) => {
              const profil = profilMap.get(p.profil_id);
              const nom = profil
                ? `${profil.prenom} ${profil.nom}`
                : `Profil ${p.profil_id.slice(0, 8)}…`;
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2.5 font-medium text-text">{nom}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-text-muted">
                      {p.statut === 'confirme' || p.statut === 'present' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                      ) : p.statut === 'absent' ? (
                        <UserX className="h-3.5 w-3.5 text-danger" aria-hidden />
                      ) : null}
                      {LIBELLES_PARTICIPANT[p.statut]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-text-muted">
                  Aucun participant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {montrerAlertes && (
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Bell className="h-4 w-4 text-ogefrem-blue" aria-hidden />
            Alertes de confirmation
          </h4>
          {alertes.length === 0 ? (
            <p className="text-sm text-text-muted">
              Aucune réponse d’invitation pour le moment. Les confirmations et
              refus apparaîtront ici.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {alertes.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    a.est_lu
                      ? 'border-border bg-surface-muted/40 text-text-muted'
                      : 'border-ogefrem-blue/25 bg-ogefrem-blue/5 text-text'
                  }`}
                >
                  <p className="font-medium">{a.message}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {formatDateHeure(a.cree_le)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
