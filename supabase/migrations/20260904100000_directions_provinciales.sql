-- 12 directions provinciales / régionales OGEFREM (entités décentralisées)
INSERT INTO public.directions (nom, code, description) VALUES
  ('Direction Provinciale de Kinshasa', 'DPKIN', 'Entité décentralisée — Kinshasa'),
  ('Direction Provinciale Ouest', 'DPO', 'Entité décentralisée — Ouest'),
  ('Direction Régionale Grand Bandundu', 'DRGB', 'Entité décentralisée — Grand Bandundu'),
  ('Direction Régionale Grand Equateur', 'DRGE', 'Entité décentralisée — Grand Equateur'),
  ('Direction Régionale Grand Kasaï', 'DRGK', 'Entité décentralisée — Grand Kasaï'),
  ('Direction Régionale de l''Ituri et Haut-Uélé', 'DRIHU', 'Entité décentralisée — Ituri et Haut-Uélé'),
  ('Direction Provinciale du Maniema', 'DPMA', 'Entité décentralisée — Maniema'),
  ('Direction Provinciale du Nord-Kivu', 'DPNK', 'Entité décentralisée — Nord-Kivu'),
  ('Direction Provinciale du Sud-Kivu', 'DPSK', 'Entité décentralisée — Sud-Kivu'),
  ('Direction Régionale Nord-Katanga', 'DRNK', 'Entité décentralisée — Nord-Katanga'),
  ('Direction Régionale Sud-Katanga', 'DRSK', 'Entité décentralisée — Sud-Katanga'),
  ('Direction Régionale de la Tshopo et Bas-Uélé', 'DRTBU', 'Entité décentralisée — Tshopo et Bas-Uélé')
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description;
