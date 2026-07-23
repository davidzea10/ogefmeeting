-- Commentaires de validation / révision sur les comptes rendus (étape 8.2)

CREATE TABLE IF NOT EXISTS public.commentaires_compte_rendu (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_rendu_id UUID NOT NULL REFERENCES public.comptes_rendus(id) ON DELETE CASCADE,
  auteur_id       UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('note', 'soumission', 'validation', 'rejet')),
  contenu         TEXT NOT NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commentaires_compte_rendu_cr_idx
  ON public.commentaires_compte_rendu(compte_rendu_id, cree_le DESC);

COMMENT ON TABLE public.commentaires_compte_rendu IS
  'Commentaires et motifs de validation/rejet des comptes rendus';
