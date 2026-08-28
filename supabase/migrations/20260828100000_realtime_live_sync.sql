-- Publication Realtime pour sync live (pause, présences, ODJ)
-- Idempotent : ignore si la table est déjà publiée.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reunions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.participants_reunion;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.points_ordre_jour;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
