import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ReunionFormWizard } from '@/components/reunions/ReunionFormWizard';

export function ReunionCreatePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: 'Nouvelle réunion' },
        ]}
      />
      <h2 className="text-2xl font-bold text-text">Nouvelle réunion</h2>
      <ReunionFormWizard mode="create" />
    </div>
  );
}
