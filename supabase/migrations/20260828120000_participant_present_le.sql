-- Horodatage d'entrée en live (ordre d'arrivée dans la liste des présences)

ALTER TABLE public.participants_reunion
  ADD COLUMN IF NOT EXISTS present_le TIMESTAMPTZ;

-- Participants déjà « présent » sans horodatage : on retombe sur cree_le
UPDATE public.participants_reunion
SET present_le = cree_le
WHERE statut = 'present' AND present_le IS NULL;
