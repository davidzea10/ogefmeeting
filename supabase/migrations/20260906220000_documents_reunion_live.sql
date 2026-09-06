-- =============================================================================
-- Documents partagés en réunion (PDF / Word) + état live (page / scroll)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.documents_reunion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id      UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  nom_fichier     TEXT NOT NULL,
  chemin_stockage TEXT NOT NULL,
  type_mime       TEXT NOT NULL,
  taille_octets   BIGINT,
  televerse_par   UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_reunion_reunion_id_idx
  ON public.documents_reunion(reunion_id);

COMMENT ON TABLE public.documents_reunion IS
  'Fichiers partagés pendant une réunion (PDF pour suivi sync, Word téléchargeable).';

ALTER TABLE public.reunions
  ADD COLUMN IF NOT EXISTS document_live_id UUID REFERENCES public.documents_reunion(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_live_page INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS document_live_scroll DOUBLE PRECISION DEFAULT 0;

COMMENT ON COLUMN public.reunions.document_live_id IS
  'Document actuellement présenté en live (suivi synchronisé).';
COMMENT ON COLUMN public.reunions.document_live_page IS
  'Page courante du document live (1-based).';
COMMENT ON COLUMN public.reunions.document_live_scroll IS
  'Ratio de scroll vertical 0–1 du document live.';

-- Bucket Storage (privé)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
