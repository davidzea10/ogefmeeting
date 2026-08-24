-- Pause réunion + transcriptions live (enregistrement optionnel)

ALTER TYPE public.statut_reunion ADD VALUE IF NOT EXISTS 'en_pause';

ALTER TABLE public.transcriptions
  ALTER COLUMN enregistrement_id DROP NOT NULL;
