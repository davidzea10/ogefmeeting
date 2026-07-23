-- 15 directions opérationnelles OGEFREM (+ DG) — idempotent
INSERT INTO public.directions (nom, code, description) VALUES
  ('Direction Générale', 'DG', 'Direction générale de l''OGEFREM'),
  ('Direction du Fret Maritime', 'DFM', 'Gestion du fret maritime'),
  ('Direction du Transit et du Fret Multimodal', 'DTFM', 'Transit et fret multimodal'),
  ('Direction des Facilitations et Affaires Commerciales', 'DFAC', 'Facilitations et affaires commerciales'),
  ('Direction de Gestion des Instruments de Traçabilité', 'DGIT', 'Gestion FERI, AD, FERE et traçabilité'),
  ('Direction des Études et de la Planification', 'DEP', 'Études et planification'),
  ('Direction de l''Application des NTIC', 'DANTIC', 'Systèmes d''information et NTIC'),
  ('Direction du Secrétariat Général', 'DSG', 'Secrétariat général'),
  ('Direction de l''Organisation et du Contrôle de Gestion', 'DOCG', 'Organisation et contrôle de gestion'),
  ('Direction des Ressources Humaines', 'DRH', 'Gestion du personnel'),
  ('Direction Financière', 'DFIN', 'Finances et comptabilité'),
  ('Direction de l''Audit Interne', 'DAI', 'Audit interne'),
  ('Direction des Affaires Juridiques', 'DAJ', 'Affaires juridiques'),
  ('Direction de l''Inspection et des Investigations', 'DII', 'Inspection et investigations'),
  ('Direction de la Sécurité des Affaires Extérieures et des Relations Multilatérales', 'DSAERM', 'Sécurité et relations multilatérales'),
  ('Direction des Relations avec les Chargeurs et Partenaires', 'DRCP', 'Relations chargeurs et partenaires')
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description;
