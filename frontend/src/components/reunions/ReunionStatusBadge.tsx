import { Badge } from '@/components/ui/Badge';
import { LIBELLES_STATUT } from '@/lib/labels';
import type { StatutReunion } from '@ogefmeeting/shared';

const variantByStatut: Record<
  StatutReunion,
  'default' | 'yellow' | 'success' | 'warning' | 'neutral' | 'danger'
> = {
  en_attente_validation: 'warning',
  planifiee: 'default',
  en_cours: 'yellow',
  cloturee: 'success',
  archivee: 'neutral',
  refusee: 'danger',
};

type Props = {
  statut: StatutReunion;
  className?: string;
};

export function ReunionStatusBadge({ statut, className }: Props) {
  return (
    <Badge variant={variantByStatut[statut]} className={className}>
      {LIBELLES_STATUT[statut]}
    </Badge>
  );
}
