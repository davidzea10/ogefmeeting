-- Étape 9.3 — Matricule + contrainte fonction organisationnelle

ALTER TABLE public.profils
  ADD COLUMN IF NOT EXISTS matricule TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profils_matricule_unique_idx
  ON public.profils (matricule)
  WHERE matricule IS NOT NULL AND btrim(matricule) <> '';

-- Normaliser les anciennes valeurs libres avant la contrainte
UPDATE public.profils
SET fonction = NULL
WHERE fonction IS NOT NULL
  AND fonction NOT IN ('agent', 'chef_service', 'sous_directeur', 'directeur');

ALTER TABLE public.profils
  DROP CONSTRAINT IF EXISTS profils_fonction_check;

ALTER TABLE public.profils
  ADD CONSTRAINT profils_fonction_check
  CHECK (
    fonction IS NULL
    OR fonction IN ('agent', 'chef_service', 'sous_directeur', 'directeur')
  );

COMMENT ON COLUMN public.profils.matricule IS 'Matricule OGEFREM (optionnel, unique si renseigné)';
COMMENT ON COLUMN public.profils.fonction IS 'Fonction organique : agent | chef_service | sous_directeur | directeur';
