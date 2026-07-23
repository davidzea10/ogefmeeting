-- Étape 9.3+ — Validation directeur des réunions proposées par les membres

ALTER TYPE public.statut_reunion ADD VALUE IF NOT EXISTS 'en_attente_validation';
ALTER TYPE public.statut_reunion ADD VALUE IF NOT EXISTS 'refusee';
