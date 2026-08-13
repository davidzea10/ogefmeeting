import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ReunionFormWizard } from '@/components/reunions/ReunionFormWizard';
import { Button } from '@/components/ui/Button';
import { obtenirReunion } from '@/lib/reunions-api';
import { peutModifierReunionRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

export function ReunionEditPage() {
  const { id } = useParams<{ id: string }>();
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? s.profil?.id);

  const reunionQuery = useQuery({
    queryKey: ['reunion', id],
    queryFn: () => obtenirReunion(id!),
    enabled: Boolean(id),
  });

  if (!id) {
    return <p className="text-danger">Identifiant manquant.</p>;
  }

  if (reunionQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-text-muted">
        Chargement…
      </div>
    );
  }

  const reunion = reunionQuery.data;
  const autorise =
    reunion &&
    peutModifierReunionRole(role, profil?.fonction, userId, reunion);

  if (!autorise) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold text-text">Modification non autorisée</h2>
        <p className="text-sm text-text-muted">
          Vous ne pouvez modifier que les réunions que vous avez créées. Les réunions
          de vos collègues sont en consultation uniquement.
        </p>
        <Link to={`/reunions/${id}`}>
          <Button variant="outline">Retour à la réunion</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: 'Modifier', href: `/reunions/${id}` },
          { label: 'Édition' },
        ]}
      />
      <h2 className="text-2xl font-bold text-text">Modifier la réunion</h2>
      <ReunionFormWizard mode="edit" reunionId={id} />
    </div>
  );
}
