-- Traçabilité validation réunion (agent → planifiée)
ALTER TABLE public.reunions
  ADD COLUMN IF NOT EXISTS valide_par UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valide_le TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS reunions_valide_par_idx ON public.reunions(valide_par);
