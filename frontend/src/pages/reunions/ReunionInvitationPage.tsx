import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDateHeure, LIBELLES_TYPE } from '@/lib/labels';
import { obtenirReunion, repondreInvitationReunion } from '@/lib/reunions-api';
import { useAuthStore } from '@/stores/auth.store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

/**
 * Page ouverte depuis le mail / la notif : confirmer ou décliner l’invitation.
 */
export function ReunionInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const reunionQuery = useQuery({
    queryKey: ['reunion', id],
    queryFn: () => obtenirReunion(id!),
    enabled: Boolean(id),
  });

  const mut = useMutation({
    mutationFn: (reponse: 'confirme' | 'absent') =>
      repondreInvitationReunion(id!, reponse),
    onSuccess: async (_data, reponse) => {
      announce(
        reponse === 'confirme'
          ? 'Invitation confirmée. Merci !'
          : 'Invitation déclinée.',
      );
      await queryClient.invalidateQueries({ queryKey: ['reunion', id] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e: Error) => announce(e.message),
  });

  if (!id) {
    return <p className="text-danger">Identifiant manquant.</p>;
  }

  if (reunionQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-text-muted">
        Chargement de l’invitation…
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
            <Button variant="outline">Mes réunions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const reunion = reunionQuery.data;
  const moi = reunion.participants.find((p) => p.profil_id === userId);
  const dejaConfirme = moi?.statut === 'confirme' || moi?.statut === 'present';
  const dejaAbsent = moi?.statut === 'absent';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: reunion.titre, href: `/reunions/${id}` },
          { label: 'Invitation' },
        ]}
      />

      <header className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <Badge variant="neutral">{LIBELLES_TYPE[reunion.type_reunion]}</Badge>
        <h2 className="mt-3 text-2xl font-bold text-text">{reunion.titre}</h2>
        <p className="mt-2 text-sm text-text-muted">
          {formatDateHeure(reunion.date_prevue)}
          {reunion.lieu ? ` · ${reunion.lieu}` : ''}
        </p>
        {reunion.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-text">{reunion.description}</p>
        ) : null}
      </header>

      {!moi ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">
          Vous n’êtes pas dans la liste des participants de cette réunion.
        </div>
      ) : dejaConfirme ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-5 text-success">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Participation confirmée</p>
            <p className="mt-1 text-sm opacity-90">
              Vous êtes bien inscrit(e) à cette réunion.
            </p>
            <Link to={`/reunions/${id}`} className="mt-3 inline-block">
              <Button size="sm">Voir la réunion</Button>
            </Link>
          </div>
        </div>
      ) : dejaAbsent ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden />
          <div>
            <p className="font-semibold text-text">Invitation déclinée</p>
            <p className="mt-1 text-sm text-text-muted">
              Vous avez indiqué que vous ne participerez pas.
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              loading={mut.isPending}
              onClick={() => mut.mutate('confirme')}
            >
              Confirmer finalement
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-ogefrem-blue/20 bg-ogefrem-blue/5 p-6">
          <h3 className="text-lg font-semibold text-text">Confirmer votre invitation</h3>
          <p className="text-sm text-text-muted">
            Vous avez reçu une invitation. Confirmez votre présence ou déclinez.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              loading={mut.isPending && mut.variables === 'confirme'}
              disabled={mut.isPending}
              onClick={() => mut.mutate('confirme')}
            >
              Confirmer ma participation
            </Button>
            <Button
              variant="outline"
              loading={mut.isPending && mut.variables === 'absent'}
              disabled={mut.isPending}
              onClick={() => mut.mutate('absent')}
            >
              Décliner
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
