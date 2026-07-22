import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description: string;
};

/** Placeholder pour les sous-étapes 6.2 / 6.3 */
export function ReunionPlaceholderPage({ title, description }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: title },
        ]}
      />
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <h2 className="text-2xl font-semibold text-text">{title}</h2>
        <p className="mt-2 text-text-muted">{description}</p>
        <Link to="/reunions" className="mt-6 inline-block">
          <Button variant="outline">Retour à la liste</Button>
        </Link>
      </div>
    </div>
  );
}
