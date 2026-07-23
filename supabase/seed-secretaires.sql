-- =============================================================================
-- 15 secrétaires (1 par direction opérationnelle, hors DG)
-- Mot de passe commun : Ogefrem123!
-- À exécuter dans Supabase → SQL Editor
-- Prérequis : les directions (codes DFM…DRCP) existent déjà
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  r record;
  v_user_id uuid;
  v_email text;
  v_prenom text;
  v_nom text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('DFM',    'Secrétaire', 'DFM',    'secretaire.dfm@ogefrem.cd'),
      ('DTFM',   'Secrétaire', 'DTFM',   'secretaire.dtfm@ogefrem.cd'),
      ('DFAC',   'Secrétaire', 'DFAC',   'secretaire.dfac@ogefrem.cd'),
      ('DGIT',   'Secrétaire', 'DGIT',   'secretaire.dgit@ogefrem.cd'),
      ('DEP',    'Secrétaire', 'DEP',    'secretaire.dep@ogefrem.cd'),
      ('DANTIC', 'Secrétaire', 'DANTIC', 'secretaire.dantic@ogefrem.cd'),
      ('DSG',    'Secrétaire', 'DSG',    'secretaire.dsg@ogefrem.cd'),
      ('DOCG',   'Secrétaire', 'DOCG',   'secretaire.docg@ogefrem.cd'),
      ('DRH',    'Secrétaire', 'DRH',    'secretaire.drh@ogefrem.cd'),
      ('DFIN',   'Secrétaire', 'DFIN',   'secretaire.dfin@ogefrem.cd'),
      ('DAI',    'Secrétaire', 'DAI',    'secretaire.dai@ogefrem.cd'),
      ('DAJ',    'Secrétaire', 'DAJ',    'secretaire.daj@ogefrem.cd'),
      ('DII',    'Secrétaire', 'DII',    'secretaire.dii@ogefrem.cd'),
      ('DSAERM', 'Secrétaire', 'DSAERM', 'secretaire.dsaerm@ogefrem.cd'),
      ('DRCP',   'Secrétaire', 'DRCP',   'secretaire.drcp@ogefrem.cd')
    ) AS t(code, prenom, nom, email)
  LOOP
    -- Direction requise
    IF NOT EXISTS (SELECT 1 FROM public.directions d WHERE d.code = r.code) THEN
      RAISE NOTICE 'Direction % introuvable — compte ignoré', r.code;
      CONTINUE;
    END IF;

    -- Déjà existant ?
    IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(r.email)) THEN
      RAISE NOTICE 'Utilisateur % déjà présent — profil mis à jour', r.email;

      UPDATE public.profils p
      SET
        prenom = r.prenom,
        nom = r.nom,
        role = 'secretaire',
        fonction = 'Secrétaire de direction',
        direction_id = (SELECT id FROM public.directions WHERE code = r.code LIMIT 1),
        est_actif = true,
        email = r.email
      WHERE p.id = (SELECT id FROM auth.users WHERE lower(email) = lower(r.email) LIMIT 1);

      CONTINUE;
    END IF;

    v_user_id := gen_random_uuid();
    v_email := r.email;
    v_prenom := r.prenom;
    v_nom := r.nom;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt('Ogefrem123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('prenom', v_prenom, 'nom', v_nom, 'first_name', v_prenom, 'last_name', v_nom),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Identité email (nécessaire pour signInWithPassword)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );

    -- Le trigger crée déjà le profil : on le complète
    UPDATE public.profils
    SET
      prenom = v_prenom,
      nom = v_nom,
      role = 'secretaire',
      fonction = 'Secrétaire de direction',
      direction_id = (SELECT id FROM public.directions WHERE code = r.code LIMIT 1),
      est_actif = true,
      email = v_email
    WHERE id = v_user_id;

    RAISE NOTICE 'Créé : % (%)', v_email, r.code;
  END LOOP;
END $$;

-- Vérification
SELECT
  p.email,
  p.prenom,
  p.nom,
  p.role,
  d.code AS direction
FROM public.profils p
LEFT JOIN public.directions d ON d.id = p.direction_id
WHERE p.role = 'secretaire'
ORDER BY d.code NULLS LAST, p.email;
