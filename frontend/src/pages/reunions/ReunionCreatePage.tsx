import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { ReunionFormWizard } from '@/components/reunions/ReunionFormWizard';
import { reunionSansValidation } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';

export function ReunionCreatePage() {
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const sansValidation = reunionSansValidation(role, profil?.fonction);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: 'Nouvelle réunion' },
        ]}
      />
      <header>
        <h2 className="text-2xl font-bold text-text">Nouvelle réunion</h2>
        {!sansValidation && (
          <p className="mt-1 text-sm text-text-muted">
            En tant que membre, votre réunion sera soumise à validation d’un
            directeur avant d’être planifiée.
          </p>
        )}
      </header>
      <ReunionFormWizard mode="create" />
    </div>
  );
}
