-- Contrôle d'affichage de la liste participants dans le corps du CR / PDF principal
ALTER TABLE comptes_rendus
  ADD COLUMN IF NOT EXISTS afficher_participants_corps BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN comptes_rendus.afficher_participants_corps IS
  'Si false, la liste des participants est exclue du corps du CR et du PDF principal (PDF annexe séparé disponible).';
