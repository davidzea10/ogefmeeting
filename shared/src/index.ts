export const APP_NAME = 'Ogefmeeting';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION =
  'Application web de gestion et intelligence des réunions — OGEFREM';

// =============================================================================
// Enums métier (alignés sur PostgreSQL — valeurs en français)
// =============================================================================

export const ROLES_UTILISATEUR = [
  'administrateur',
  'directeur',
  'secretaire',
  'participant',
  'lecteur',
] as const;
export type RoleUtilisateur = (typeof ROLES_UTILISATEUR)[number];

/**
 * Rôles proposés à la création / édition admin.
 * « participant » et « lecteur » ne sont plus assignés manuellement.
 */
export const ROLES_ASSIGNABLES_ADMIN = [
  'administrateur',
  'secretaire',
  'directeur',
] as const;
export type RoleAssignableAdmin = (typeof ROLES_ASSIGNABLES_ADMIN)[number];

/** Fonctions organiques OGEFREM (distinctes du rôle applicatif) */
export const FONCTIONS_ORGANISATION = [
  'agent',
  'chef_service',
  'sous_directeur',
  'directeur',
] as const;
export type FonctionOrganisation = (typeof FONCTIONS_ORGANISATION)[number];

/** Fonctions autorisées à créer une réunion déjà planifiée (sans validation) */
export const FONCTIONS_CREATION_REUNION = [
  'chef_service',
  'sous_directeur',
  'directeur',
] as const;

/** Mot de passe par défaut à la création d’un membre (admin) */
export const MOT_DE_PASSE_DEFAUT = 'Ogefrem123!';

/** Rôle applicatif dérivé de la fonction si aucun rôle spécial n’est choisi */
export function roleDepuisFonction(
  fonction: FonctionOrganisation | string | null | undefined,
): RoleUtilisateur {
  if (
    fonction &&
    (FONCTIONS_CREATION_REUNION as readonly string[]).includes(fonction)
  ) {
    return 'directeur';
  }
  return 'participant';
}

/**
 * Tous les membres authentifiés peuvent proposer / créer une réunion.
 * (L’approbation directeur s’applique aux agents — voir reunionDirectementPlanifiee.)
 */
export function peutCreerReunion(
  _role?: RoleUtilisateur | null,
  _fonction?: string | null,
): boolean {
  return true;
}

/** Secrétaire, direction, admin : réunion créée directement « planifiée » */
export function reunionDirectementPlanifiee(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
): boolean {
  if (role === 'administrateur' || role === 'secretaire' || role === 'directeur') {
    return true;
  }
  return Boolean(
    fonction && (FONCTIONS_CREATION_REUNION as readonly string[]).includes(fonction),
  );
}

/** Voit le catalogue complet des réunions (sinon : ses invitations + ses créations) */
export function voitToutesLesReunions(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
): boolean {
  return reunionDirectementPlanifiee(role, fonction);
}

/** Directeur / sous-directeur / admin : valide ou refuse une proposition */
export function peutApprouverReunion(
  role: RoleUtilisateur | null | undefined,
  fonction?: string | null,
): boolean {
  if (role === 'administrateur' || role === 'directeur') return true;
  return fonction === 'directeur' || fonction === 'sous_directeur';
}

/** @deprecated Utiliser ROLES_UTILISATEUR */
export const USER_ROLES = ROLES_UTILISATEUR;
export type UserRole = RoleUtilisateur;

export const STATUTS_REUNION = [
  'en_attente_validation',
  'planifiee',
  'en_cours',
  'cloturee',
  'archivee',
  'refusee',
] as const;
export type StatutReunion = (typeof STATUTS_REUNION)[number];

/** @deprecated Utiliser STATUTS_REUNION */
export const MEETING_STATUSES = STATUTS_REUNION;
export type MeetingStatus = StatutReunion;

export const TYPES_REUNION = [
  'conseil_direction',
  'technique',
  'operationnel',
  'partenaire',
  'autre',
] as const;
export type TypeReunion = (typeof TYPES_REUNION)[number];

/** @deprecated Utiliser TYPES_REUNION */
export const MEETING_TYPES = TYPES_REUNION;
export type MeetingType = TypeReunion;

export const STATUTS_COMPTE_RENDU = [
  'brouillon',
  'soumis',
  'en_revision',
  'valide',
  'archive',
] as const;
export type StatutCompteRendu = (typeof STATUTS_COMPTE_RENDU)[number];

/** @deprecated Utiliser STATUTS_COMPTE_RENDU */
export const REPORT_STATUSES = STATUTS_COMPTE_RENDU;
export type ReportStatus = StatutCompteRendu;

export const PRIORITES_ACTION = ['basse', 'moyenne', 'haute', 'critique'] as const;
export type PrioriteAction = (typeof PRIORITES_ACTION)[number];

/** @deprecated Utiliser PRIORITES_ACTION */
export const ACTION_PRIORITIES = PRIORITES_ACTION;
export type ActionPriority = PrioriteAction;

export const STATUTS_ACTION = [
  'en_attente',
  'en_cours',
  'terminee',
  'annulee',
  'en_retard',
] as const;
export type StatutAction = (typeof STATUTS_ACTION)[number];

/** @deprecated Utiliser STATUTS_ACTION */
export const ACTION_STATUSES = STATUTS_ACTION;
export type ActionStatus = StatutAction;

export const STATUTS_PARTICIPANT = [
  'invite',
  'confirme',
  'present',
  'absent',
] as const;
export type StatutParticipant = (typeof STATUTS_PARTICIPANT)[number];

/** @deprecated Utiliser STATUTS_PARTICIPANT */
export const PARTICIPANT_STATUSES = STATUTS_PARTICIPANT;
export type ParticipantStatus = StatutParticipant;

export const STATUTS_TRANSCRIPTION = [
  'en_attente',
  'en_traitement',
  'terminee',
  'echouee',
] as const;
export type StatutTranscription = (typeof STATUTS_TRANSCRIPTION)[number];

/** @deprecated Utiliser STATUTS_TRANSCRIPTION */
export const TRANSCRIPTION_STATUSES = STATUTS_TRANSCRIPTION;
export type TranscriptionStatus = StatutTranscription;

export const STORAGE_BUCKETS = ['recordings', 'exports', 'avatars'] as const;
export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** Noms des tables PostgreSQL */
export const TABLES = {
  directions: 'directions',
  profils: 'profils',
  modelesCompteRendu: 'modeles_compte_rendu',
  reunions: 'reunions',
  participantsReunion: 'participants_reunion',
  pointsOrdreJour: 'points_ordre_jour',
  enregistrements: 'enregistrements',
  comptesRendus: 'comptes_rendus',
  versionsCompteRendu: 'versions_compte_rendu',
  decisions: 'decisions',
  actions: 'actions',
  transcriptions: 'transcriptions',
  segmentsTranscription: 'segments_transcription',
  empreintesVocales: 'empreintes_vocales',
  notifications: 'notifications',
  journauxAudit: 'journaux_audit',
  commentairesCompteRendu: 'commentaires_compte_rendu',
  parametresApplication: 'parametres_application',
} as const;

// =============================================================================
// Types API
// =============================================================================

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type HealthStatus = {
  app: string;
  version: string;
  environment: string;
  status: 'ok' | 'degraded' | 'down';
  supabase: 'configured' | 'connected' | 'not_configured' | 'error';
  database?: {
    directions: number;
    templates: number;
  };
  auth?: {
    enforced: boolean;
    anon_configured: boolean;
  };
  timestamp: string;
};

// =============================================================================
// Entités (propriétés en français, alignées sur la BDD)
// =============================================================================

export type Direction = {
  id: string;
  nom: string;
  code: string | null;
  description: string | null;
  cree_le: string;
  modifie_le: string;
};

export type Profil = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  direction_id: string | null;
  fonction: string | null;
  matricule: string | null;
  url_avatar: string | null;
  role: RoleUtilisateur;
  est_actif: boolean;
  cree_le: string;
  modifie_le: string;
};

/** @deprecated Utiliser Profil */
export type Profile = Profil;

export type ModeleCompteRendu = {
  id: string;
  nom: string;
  identifiant: string;
  description: string | null;
  sections: SectionCompteRendu[];
  est_par_defaut: boolean;
  cree_le: string;
  modifie_le: string;
};

/** @deprecated Utiliser ModeleCompteRendu */
export type ReportTemplate = ModeleCompteRendu;

export type SectionCompteRendu = {
  cle: string;
  libelle: string;
};

/** @deprecated Utiliser SectionCompteRendu */
export type ReportSection = SectionCompteRendu;

export type Reunion = {
  id: string;
  titre: string;
  description: string | null;
  type_reunion: TypeReunion;
  statut: StatutReunion;
  date_prevue: string;
  date_debut: string | null;
  date_fin: string | null;
  lieu: string | null;
  direction_id: string | null;
  modele_id: string | null;
  cree_par: string | null;
  cree_le: string;
  modifie_le: string;
};

/** @deprecated Utiliser Reunion */
export type Meeting = Reunion;

export type ParticipantReunion = {
  id: string;
  reunion_id: string;
  profil_id: string;
  statut: StatutParticipant;
  cree_le: string;
};

export type PointOrdreJour = {
  id: string;
  reunion_id: string;
  titre: string;
  description: string | null;
  ordre: number;
  est_traite: boolean;
  duree_minutes: number | null;
  cree_le: string;
  modifie_le: string;
};

export type ReunionDetail = Reunion & {
  participants: ParticipantReunion[];
  points_ordre_jour: PointOrdreJour[];
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    limite: number;
    total: number;
    total_pages: number;
  };
};

export type CompteRendu = {
  id: string;
  reunion_id: string;
  statut: StatutCompteRendu;
  contenu: Record<string, unknown>;
  contenu_html: string | null;
  version: number;
  soumis_le: string | null;
  valide_le: string | null;
  valide_par: string | null;
  chemin_pdf: string | null;
  cree_par: string | null;
  cree_le: string;
  modifie_le: string;
};

export type VersionCompteRendu = {
  id: string;
  compte_rendu_id: string;
  version: number;
  contenu: Record<string, unknown>;
  modifie_par: string | null;
  cree_le: string;
};

export const TYPES_COMMENTAIRE_CR = [
  'note',
  'soumission',
  'validation',
  'rejet',
] as const;
export type TypeCommentaireCr = (typeof TYPES_COMMENTAIRE_CR)[number];

export type CommentaireCompteRendu = {
  id: string;
  compte_rendu_id: string;
  auteur_id: string | null;
  type: TypeCommentaireCr;
  contenu: string;
  cree_le: string;
  /** Enrichi côté API (optionnel) */
  auteur_nom?: string | null;
};

export type Decision = {
  id: string;
  reunion_id: string;
  compte_rendu_id: string | null;
  titre: string;
  description: string | null;
  decide_le: string;
  cree_par: string | null;
  cree_le: string;
};

export type ActionSuivi = {
  id: string;
  reunion_id: string;
  compte_rendu_id: string | null;
  decision_id: string | null;
  titre: string;
  description: string | null;
  responsable_id: string | null;
  priorite: PrioriteAction;
  statut: StatutAction;
  date_echeance: string | null;
  termine_le: string | null;
  cree_par: string | null;
  cree_le: string;
  modifie_le: string;
};

export type ResultatRecherche = {
  comptes_rendus: CompteRendu[];
  reunions: Reunion[];
  decisions: Decision[];
  actions: ActionSuivi[];
};

/** Agrégats du tableau de bord (étape 9.1) */
export type DashboardResume = {
  reunions_a_venir: number;
  reunions_en_cours: number;
  reunions_mois: number;
  cr_brouillons: number;
  cr_soumis: number;
  cr_valides_mois: number;
  cr_crees_mois: number;
  taux_validation_mois: number | null;
  actions_ouvertes: number;
  actions_en_retard: number;
  mes_actions_ouvertes: number;
  mois_libelle: string;
};

export type ParametresApplication = {
  id: number;
  logo_url: string | null;
  en_tete_pdf: string;
  sous_titre_pdf: string;
  duree_retention_jours: number;
  modifie_le: string;
  modifie_par: string | null;
};

export const TYPES_NOTIFICATION = [
  'invitation_reunion',
  'reunion_approuvee',
  'reunion_refusee',
  'cr_soumis',
  'cr_a_valider',
  'cr_en_revision',
  'cr_valide',
  'cr_publie',
  'cr_archive',
  'action_en_retard',
] as const;
export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];

export type NotificationApp = {
  id: string;
  profil_id: string;
  type: string;
  titre: string;
  message: string;
  lien: string | null;
  est_lu: boolean;
  metadonnees: Record<string, unknown>;
  cree_le: string;
};

export type JournalAudit = {
  id: string;
  profil_id: string | null;
  action: string;
  type_entite: string | null;
  entite_id: string | null;
  metadonnees: Record<string, unknown>;
  adresse_ip: string | null;
  cree_le: string;
};
