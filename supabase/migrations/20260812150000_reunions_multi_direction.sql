-- Réunions multi-direction : table de liaison N-N
CREATE TABLE public.reunions_directions (
  reunion_id   UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  direction_id UUID NOT NULL REFERENCES public.directions(id) ON DELETE CASCADE,
  cree_le      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reunion_id, direction_id)
);

CREATE INDEX reunions_directions_direction_id_idx
  ON public.reunions_directions(direction_id);

-- Rétrocompat : copier direction_id existant
INSERT INTO public.reunions_directions (reunion_id, direction_id)
SELECT id, direction_id
FROM public.reunions
WHERE direction_id IS NOT NULL
ON CONFLICT DO NOTHING;
