import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDirection, LIBELLES_STATUT, LIBELLES_TYPE } from '@/lib/labels';
import type { ListerReunionsParams } from '@/lib/reunions-api';
import { STATUTS_REUNION, TYPES_REUNION, type Direction, type Profil } from '@ogefmeeting/shared';
import { Search, X } from 'lucide-react';

export type ReunionFiltersState = {
  recherche: string;
  statut: string;
  type_reunion: string;
  direction_id: string;
  participant_id: string;
  date_debut: string;
  date_fin: string;
  tri: NonNullable<ListerReunionsParams['tri']>;
  ordre: 'asc' | 'desc';
};

export const FILTRES_VIDES: ReunionFiltersState = {
  recherche: '',
  statut: '',
  type_reunion: '',
  direction_id: '',
  participant_id: '',
  date_debut: '',
  date_fin: '',
  tri: 'date_prevue',
  ordre: 'desc',
};

type Props = {
  value: ReunionFiltersState;
  onChange: (next: ReunionFiltersState) => void;
  directions: Direction[];
  profils: Profil[];
};

const selectClass =
  'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25';

export function ReunionFilters({ value, onChange, directions, profils }: Props) {
  function patch(partial: Partial<ReunionFiltersState>) {
    onChange({ ...value, ...partial });
  }

  const hasFilters =
    value.recherche ||
    value.statut ||
    value.type_reunion ||
    value.direction_id ||
    value.participant_id ||
    value.date_debut ||
    value.date_fin;

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm"
      aria-label="Filtres des réunions"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={value.recherche}
          onChange={(e) => patch({ recherche: e.target.value })}
          placeholder="Rechercher par titre..."
          className={`${selectClass} pl-10`}
          aria-label="Rechercher une réunion"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text">Statut</span>
          <select
            className={selectClass}
            value={value.statut}
            onChange={(e) => patch({ statut: e.target.value })}
          >
            <option value="">Tous</option>
            {STATUTS_REUNION.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUT[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text">Type</span>
          <select
            className={selectClass}
            value={value.type_reunion}
            onChange={(e) => patch({ type_reunion: e.target.value })}
          >
            <option value="">Tous</option>
            {TYPES_REUNION.map((t) => (
              <option key={t} value={t}>
                {LIBELLES_TYPE[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text">Direction</span>
          <select
            className={selectClass}
            value={value.direction_id}
            onChange={(e) => patch({ direction_id: e.target.value })}
          >
            <option value="">Toutes</option>
            {directions.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDirection(d)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-text">Participant</span>
          <select
            className={selectClass}
            value={value.participant_id}
            onChange={(e) => patch({ participant_id: e.target.value })}
          >
            <option value="">Tous</option>
            {profils.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Du"
          type="date"
          value={value.date_debut}
          onChange={(e) => patch({ date_debut: e.target.value })}
        />
        <Input
          label="Au"
          type="date"
          value={value.date_fin}
          onChange={(e) => patch({ date_fin: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">Trier par</span>
            <select
              className={selectClass}
              value={value.tri}
              onChange={(e) =>
                patch({ tri: e.target.value as ReunionFiltersState['tri'] })
              }
            >
              <option value="date_prevue">Date</option>
              <option value="titre">Titre</option>
              <option value="statut">Statut</option>
              <option value="cree_le">Création</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">Ordre</span>
            <select
              className={selectClass}
              value={value.ordre}
              onChange={(e) => patch({ ordre: e.target.value as 'asc' | 'desc' })}
            >
              <option value="desc">Décroissant</option>
              <option value="asc">Croissant</option>
            </select>
          </label>
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...FILTRES_VIDES,
                tri: value.tri,
                ordre: value.ordre,
              })
            }
          >
            <X className="h-4 w-4" aria-hidden />
            Réinitialiser
          </Button>
        )}
      </div>
    </section>
  );
}
