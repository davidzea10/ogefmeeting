-- Texte STT partagé en live (visible par tous les participants)

ALTER TABLE public.reunions
  ADD COLUMN IF NOT EXISTS transcription_live_texte TEXT,
  ADD COLUMN IF NOT EXISTS transcription_live_interim TEXT;
