-- Paramètres généraux de l’application (ligne unique id = 1)

CREATE TABLE IF NOT EXISTS public.parametres_application (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url              TEXT,
  en_tete_pdf           TEXT NOT NULL DEFAULT 'OGEFREM — Office de Gestion du Fret Multimodal',
  sous_titre_pdf        TEXT NOT NULL DEFAULT 'Ogefmeeting — Compte rendu de réunion',
  duree_retention_jours INTEGER NOT NULL DEFAULT 365
    CHECK (duree_retention_jours >= 30 AND duree_retention_jours <= 3650),
  modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_par           UUID REFERENCES public.profils(id) ON DELETE SET NULL
);

INSERT INTO public.parametres_application (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.parametres_application IS 'Paramètres globaux (logo, en-tête PDF, rétention)';
