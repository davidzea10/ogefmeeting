-- =============================================================================
-- Ogefmeeting — Schéma initial (tables, colonnes et enums en français)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Types énumérés
-- =============================================================================

CREATE TYPE public.role_utilisateur AS ENUM (
  'administrateur',
  'directeur',
  'secretaire',
  'participant',
  'lecteur'
);

CREATE TYPE public.statut_reunion AS ENUM (
  'planifiee',
  'en_cours',
  'cloturee',
  'archivee'
);

CREATE TYPE public.type_reunion AS ENUM (
  'conseil_direction',
  'technique',
  'operationnel',
  'partenaire',
  'autre'
);

CREATE TYPE public.statut_compte_rendu AS ENUM (
  'brouillon',
  'soumis',
  'en_revision',
  'valide',
  'archive'
);

CREATE TYPE public.priorite_action AS ENUM (
  'basse',
  'moyenne',
  'haute',
  'critique'
);

CREATE TYPE public.statut_action AS ENUM (
  'en_attente',
  'en_cours',
  'terminee',
  'annulee',
  'en_retard'
);

CREATE TYPE public.statut_participant AS ENUM (
  'invite',
  'confirme',
  'present',
  'absent'
);

CREATE TYPE public.statut_transcription AS ENUM (
  'en_attente',
  'en_traitement',
  'terminee',
  'echouee'
);

-- =============================================================================
-- Fonction utilitaire
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maj_date_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modifie_le = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- directions
-- =============================================================================

CREATE TABLE public.directions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  code        TEXT UNIQUE,
  description TEXT,
  cree_le     TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER directions_maj_date
  BEFORE UPDATE ON public.directions
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- profils
-- =============================================================================

CREATE TABLE public.profils (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  prenom        TEXT NOT NULL,
  nom           TEXT NOT NULL,
  direction_id  UUID REFERENCES public.directions(id) ON DELETE SET NULL,
  fonction      TEXT,
  url_avatar    TEXT,
  role          public.role_utilisateur NOT NULL DEFAULT 'participant',
  est_actif     BOOLEAN NOT NULL DEFAULT true,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX profils_direction_id_idx ON public.profils(direction_id);
CREATE INDEX profils_role_idx ON public.profils(role);
CREATE INDEX profils_email_idx ON public.profils(email);

CREATE TRIGGER profils_maj_date
  BEFORE UPDATE ON public.profils
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

CREATE OR REPLACE FUNCTION public.creer_profil_utilisateur()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profils (id, email, prenom, nom)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'prenom',
      NEW.raw_user_meta_data ->> 'first_name',
      'Utilisateur'
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'nom',
      NEW.raw_user_meta_data ->> 'last_name',
      'OGEFREM'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER apres_creation_utilisateur_auth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.creer_profil_utilisateur();

-- =============================================================================
-- modeles_compte_rendu
-- =============================================================================

CREATE TABLE public.modeles_compte_rendu (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT NOT NULL,
  identifiant     TEXT NOT NULL UNIQUE,
  description     TEXT,
  sections        JSONB NOT NULL DEFAULT '[]'::jsonb,
  est_par_defaut  BOOLEAN NOT NULL DEFAULT false,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER modeles_compte_rendu_maj_date
  BEFORE UPDATE ON public.modeles_compte_rendu
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- reunions
-- =============================================================================

CREATE TABLE public.reunions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre         TEXT NOT NULL,
  description   TEXT,
  type_reunion  public.type_reunion NOT NULL DEFAULT 'autre',
  statut        public.statut_reunion NOT NULL DEFAULT 'planifiee',
  date_prevue   TIMESTAMPTZ NOT NULL,
  date_debut    TIMESTAMPTZ,
  date_fin      TIMESTAMPTZ,
  lieu          TEXT,
  direction_id  UUID REFERENCES public.directions(id) ON DELETE SET NULL,
  modele_id     UUID REFERENCES public.modeles_compte_rendu(id) ON DELETE SET NULL,
  cree_par      UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reunions_statut_idx ON public.reunions(statut);
CREATE INDEX reunions_date_prevue_idx ON public.reunions(date_prevue DESC);
CREATE INDEX reunions_direction_id_idx ON public.reunions(direction_id);
CREATE INDEX reunions_cree_par_idx ON public.reunions(cree_par);

CREATE TRIGGER reunions_maj_date
  BEFORE UPDATE ON public.reunions
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- participants_reunion
-- =============================================================================

CREATE TABLE public.participants_reunion (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  profil_id  UUID NOT NULL REFERENCES public.profils(id) ON DELETE CASCADE,
  statut     public.statut_participant NOT NULL DEFAULT 'invite',
  cree_le    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reunion_id, profil_id)
);

CREATE INDEX participants_reunion_reunion_id_idx ON public.participants_reunion(reunion_id);
CREATE INDEX participants_reunion_profil_id_idx ON public.participants_reunion(profil_id);

-- =============================================================================
-- points_ordre_jour
-- =============================================================================

CREATE TABLE public.points_ordre_jour (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id     UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  titre          TEXT NOT NULL,
  description    TEXT,
  ordre          INT NOT NULL DEFAULT 0,
  est_traite     BOOLEAN NOT NULL DEFAULT false,
  duree_minutes  INT,
  cree_le        TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX points_ordre_jour_reunion_id_idx ON public.points_ordre_jour(reunion_id, ordre);

CREATE TRIGGER points_ordre_jour_maj_date
  BEFORE UPDATE ON public.points_ordre_jour
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- enregistrements
-- =============================================================================

CREATE TABLE public.enregistrements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id      UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  chemin_stockage TEXT NOT NULL,
  nom_fichier     TEXT NOT NULL,
  type_mime       TEXT NOT NULL DEFAULT 'audio/webm',
  taille_octets   BIGINT,
  duree_secondes  INT,
  televerse_par   UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX enregistrements_reunion_id_idx ON public.enregistrements(reunion_id);

-- =============================================================================
-- comptes_rendus
-- =============================================================================

CREATE TABLE public.comptes_rendus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id    UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  statut        public.statut_compte_rendu NOT NULL DEFAULT 'brouillon',
  contenu       JSONB NOT NULL DEFAULT '{}'::jsonb,
  contenu_html  TEXT,
  version       INT NOT NULL DEFAULT 1,
  soumis_le     TIMESTAMPTZ,
  valide_le     TIMESTAMPTZ,
  valide_par    UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  chemin_pdf    TEXT,
  cree_par      UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX comptes_rendus_reunion_id_idx ON public.comptes_rendus(reunion_id);
CREATE INDEX comptes_rendus_statut_idx ON public.comptes_rendus(statut);
CREATE INDEX comptes_rendus_recherche_idx ON public.comptes_rendus
  USING gin (to_tsvector('french', coalesce(contenu_html, '')));

CREATE TRIGGER comptes_rendus_maj_date
  BEFORE UPDATE ON public.comptes_rendus
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- versions_compte_rendu
-- =============================================================================

CREATE TABLE public.versions_compte_rendu (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_rendu_id UUID NOT NULL REFERENCES public.comptes_rendus(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  contenu         JSONB NOT NULL,
  modifie_par     UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (compte_rendu_id, version)
);

CREATE INDEX versions_compte_rendu_id_idx ON public.versions_compte_rendu(compte_rendu_id);

-- =============================================================================
-- decisions
-- =============================================================================

CREATE TABLE public.decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id      UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  compte_rendu_id UUID REFERENCES public.comptes_rendus(id) ON DELETE SET NULL,
  titre           TEXT NOT NULL,
  description     TEXT,
  decide_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cree_par        UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX decisions_reunion_id_idx ON public.decisions(reunion_id);

-- =============================================================================
-- actions
-- =============================================================================

CREATE TABLE public.actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id      UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  compte_rendu_id UUID REFERENCES public.comptes_rendus(id) ON DELETE SET NULL,
  decision_id     UUID REFERENCES public.decisions(id) ON DELETE SET NULL,
  titre           TEXT NOT NULL,
  description     TEXT,
  responsable_id  UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  priorite        public.priorite_action NOT NULL DEFAULT 'moyenne',
  statut          public.statut_action NOT NULL DEFAULT 'en_attente',
  date_echeance   DATE,
  termine_le      TIMESTAMPTZ,
  cree_par        UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX actions_reunion_id_idx ON public.actions(reunion_id);
CREATE INDEX actions_responsable_id_idx ON public.actions(responsable_id);
CREATE INDEX actions_statut_idx ON public.actions(statut);
CREATE INDEX actions_date_echeance_idx ON public.actions(date_echeance);

CREATE TRIGGER actions_maj_date
  BEFORE UPDATE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- Phase IA
-- =============================================================================

CREATE TABLE public.transcriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enregistrement_id UUID NOT NULL REFERENCES public.enregistrements(id) ON DELETE CASCADE,
  reunion_id        UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  statut            public.statut_transcription NOT NULL DEFAULT 'en_attente',
  langue            TEXT NOT NULL DEFAULT 'fr',
  texte_complet     TEXT,
  score_confiance   NUMERIC(5, 4),
  traite_le         TIMESTAMPTZ,
  cree_le           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transcriptions_reunion_id_idx ON public.transcriptions(reunion_id);
CREATE INDEX transcriptions_enregistrement_id_idx ON public.transcriptions(enregistrement_id);

CREATE TABLE public.segments_transcription (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id  UUID NOT NULL REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  libelle_locuteur  TEXT,
  profil_id         UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  debut             NUMERIC(10, 3) NOT NULL,
  fin               NUMERIC(10, 3) NOT NULL,
  texte             TEXT NOT NULL,
  score_confiance   NUMERIC(5, 4),
  ordre             INT NOT NULL DEFAULT 0,
  cree_le           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX segments_transcription_id_idx
  ON public.segments_transcription(transcription_id, ordre);

CREATE TABLE public.empreintes_vocales (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id                UUID NOT NULL UNIQUE REFERENCES public.profils(id) ON DELETE CASCADE,
  chemin_stockage          TEXT,
  empreinte                JSONB,
  duree_echantillon_secondes INT,
  est_actif                BOOLEAN NOT NULL DEFAULT true,
  cree_le                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER empreintes_vocales_maj_date
  BEFORE UPDATE ON public.empreintes_vocales
  FOR EACH ROW EXECUTE FUNCTION public.maj_date_modification();

-- =============================================================================
-- notifications
-- =============================================================================

CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id  UUID NOT NULL REFERENCES public.profils(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  titre      TEXT NOT NULL,
  message    TEXT,
  lien       TEXT,
  est_lu     BOOLEAN NOT NULL DEFAULT false,
  metadonnees JSONB NOT NULL DEFAULT '{}'::jsonb,
  cree_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_profil_id_idx ON public.notifications(profil_id, est_lu, cree_le DESC);

-- =============================================================================
-- journaux_audit
-- =============================================================================

CREATE TABLE public.journaux_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id    UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  type_entite  TEXT,
  entite_id    UUID,
  metadonnees  JSONB NOT NULL DEFAULT '{}'::jsonb,
  adresse_ip   INET,
  cree_le      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX journaux_audit_profil_id_idx ON public.journaux_audit(profil_id);
CREATE INDEX journaux_audit_entite_idx ON public.journaux_audit(type_entite, entite_id);
CREATE INDEX journaux_audit_cree_le_idx ON public.journaux_audit(cree_le DESC);

-- =============================================================================
-- Vues
-- =============================================================================

CREATE OR REPLACE VIEW public.reunions_avec_statistiques AS
SELECT
  r.*,
  d.nom AS nom_direction,
  COUNT(DISTINCT pr.id) AS nb_participants,
  COUNT(DISTINCT e.id) AS nb_enregistrements,
  MAX(cr.statut::text) AS dernier_statut_cr
FROM public.reunions r
LEFT JOIN public.directions d ON d.id = r.direction_id
LEFT JOIN public.participants_reunion pr ON pr.reunion_id = r.id
LEFT JOIN public.enregistrements e ON e.reunion_id = r.id
LEFT JOIN public.comptes_rendus cr ON cr.reunion_id = r.id
GROUP BY r.id, d.nom;

CREATE OR REPLACE VIEW public.actions_en_attente AS
SELECT
  a.*,
  r.titre AS titre_reunion,
  p.prenom || ' ' || p.nom AS nom_responsable
FROM public.actions a
JOIN public.reunions r ON r.id = a.reunion_id
LEFT JOIN public.profils p ON p.id = a.responsable_id
WHERE a.statut IN ('en_attente', 'en_cours', 'en_retard')
ORDER BY a.date_echeance NULLS LAST, a.cree_le DESC;
