import type { Profil } from '@ogefmeeting/shared';

/** IDs de directions liées à une réunion (multi-direction ou direction unique). */
export function idsDirectionsReunion(reunion: {
  direction_id?: string | null;
  direction_ids?: string[] | null;
}): string[] {
  if (reunion.direction_ids?.length) {
    return [...new Set(reunion.direction_ids.filter(Boolean))];
  }
  if (reunion.direction_id) return [reunion.direction_id];
  return [];
}

/** Limite l’annuaire aux profils rattachés aux directions concernées. */
export function filtrerProfilsParDirections(
  profils: Profil[],
  directionIds: string[],
): Profil[] {
  if (directionIds.length === 0) return profils;
  const scope = new Set(directionIds);
  return profils.filter((p) => p.direction_id && scope.has(p.direction_id));
}
