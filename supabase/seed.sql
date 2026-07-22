-- =============================================================================
-- Ogefmeeting — Données initiales (seed)
-- =============================================================================

INSERT INTO public.directions (nom, code, description) VALUES
  ('Direction Générale', 'DG', 'Direction générale de l''OGEFREM'),
  ('Direction de Gestion des Instruments de Traçabilité', 'DGIT', 'Gestion FERI, AD, FERE et traçabilité du fret'),
  ('Direction de l''Application des NTIC', 'DANTIC', 'Systèmes d''information et technologies'),
  ('Direction Commerciale', 'DCOM', 'Relations commerciales et mandataires'),
  ('Direction des Ressources Humaines', 'DRH', 'Gestion du personnel'),
  ('Direction Financière', 'DFIN', 'Finances et comptabilité')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.modeles_compte_rendu (nom, identifiant, description, sections, est_par_defaut) VALUES
  (
    'Conseil de direction',
    'conseil_direction',
    'Compte rendu pour les réunions du conseil de direction',
    '[
      {"cle": "contexte", "libelle": "Contexte et objectifs"},
      {"cle": "participants", "libelle": "Participants"},
      {"cle": "ordre_du_jour", "libelle": "Points abordés"},
      {"cle": "decisions", "libelle": "Décisions prises"},
      {"cle": "actions", "libelle": "Actions à mener"},
      {"cle": "prochaine_reunion", "libelle": "Prochaine réunion"}
    ]'::jsonb,
    true
  ),
  (
    'Comité technique',
    'technique',
    'Compte rendu pour les réunions techniques (DGIT, DANTIC)',
    '[
      {"cle": "contexte", "libelle": "Contexte"},
      {"cle": "participants", "libelle": "Participants"},
      {"cle": "points_techniques", "libelle": "Points techniques"},
      {"cle": "decisions", "libelle": "Décisions"},
      {"cle": "actions", "libelle": "Actions"},
      {"cle": "risques", "libelle": "Risques identifiés"}
    ]'::jsonb,
    false
  ),
  (
    'Point opérationnel',
    'operationnel',
    'Compte rendu pour les points opérationnels quotidiens',
    '[
      {"cle": "synthese", "libelle": "Synthèse"},
      {"cle": "operations", "libelle": "Opérations"},
      {"cle": "blocages", "libelle": "Blocages"},
      {"cle": "actions", "libelle": "Actions immédiates"}
    ]'::jsonb,
    false
  ),
  (
    'Réunion partenaires / mandataires',
    'partenaire',
    'Compte rendu pour les réunions avec mandataires et partenaires',
    '[
      {"cle": "contexte", "libelle": "Contexte"},
      {"cle": "participants", "libelle": "Participants"},
      {"cle": "echanges", "libelle": "Échanges"},
      {"cle": "accords", "libelle": "Accords"},
      {"cle": "suivi", "libelle": "Suivi"}
    ]'::jsonb,
    false
  )
ON CONFLICT (identifiant) DO NOTHING;
