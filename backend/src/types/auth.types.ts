import type { RoleUtilisateur } from '@ogefmeeting/shared';
import type { User } from '@supabase/supabase-js';

/**
 * Utilisateur authentifié attaché à la requête (si JWT valide).
 */
export type AuthUser = {
  id: string;
  email: string;
  role: RoleUtilisateur;
  prenom: string;
  nom: string;
  direction_id: string | null;
  auth: User;
};
