import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ReunionFormWizard } from '@/components/reunions/ReunionFormWizard';
import { useParams } from 'react-router-dom';

export function ReunionEditPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="text-danger">Identifiant manquant.</p>;
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
