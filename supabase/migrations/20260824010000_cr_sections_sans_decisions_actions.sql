-- Structure CR : Introduction → Points ODJ → Conclusion (sans sections Décisions/Actions)

UPDATE public.modeles_compte_rendu
SET sections = '[
  {"cle": "contexte", "libelle": "Introduction"},
  {"cle": "participants", "libelle": "Participants"},
  {"cle": "ordre_du_jour", "libelle": "Points de l’ordre du jour"},
  {"cle": "conclusion", "libelle": "Conclusion"}
]'::jsonb
WHERE identifiant = 'conseil_direction';

UPDATE public.modeles_compte_rendu
SET sections = '[
  {"cle": "contexte", "libelle": "Introduction"},
  {"cle": "participants", "libelle": "Participants"},
  {"cle": "points_techniques", "libelle": "Points techniques"},
  {"cle": "conclusion", "libelle": "Conclusion"}
]'::jsonb
WHERE identifiant = 'technique';

UPDATE public.modeles_compte_rendu
SET sections = '[
  {"cle": "contexte", "libelle": "Introduction"},
  {"cle": "operations", "libelle": "Points abordés"},
  {"cle": "conclusion", "libelle": "Conclusion"}
]'::jsonb
WHERE identifiant = 'operationnel';

UPDATE public.modeles_compte_rendu
SET sections = '[
  {"cle": "contexte", "libelle": "Introduction"},
  {"cle": "participants", "libelle": "Participants"},
  {"cle": "echanges", "libelle": "Points de l’ordre du jour"},
  {"cle": "conclusion", "libelle": "Conclusion"}
]'::jsonb
WHERE identifiant = 'partenaire';
