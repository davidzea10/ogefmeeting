-- =============================================================================
-- Ogefmeeting — Buckets Storage
-- Étape 2.4 — Stockage fichiers (sans politiques RLS, étape 4)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'recordings',
    'recordings',
    false,
    524288000,
    ARRAY['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg']
  ),
  (
    'exports',
    'exports',
    false,
    52428800,
    ARRAY['application/pdf']
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;
