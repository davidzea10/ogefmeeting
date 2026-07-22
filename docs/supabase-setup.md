# Étape 2 — Base de données Supabase

Guide pas à pas pour configurer Supabase pour **Ogefmeeting**.  
La sécurité **RLS** (Row Level Security) est volontairement reportée à l’**étape 4** (Authentification).

---

## Vue d’ensemble

| Sous-étape | Contenu | Où agir |
|------------|---------|---------|
| **2.1** | Modélisation & création du projet | Dashboard Supabase |
| **2.2** | Migrations SQL (schéma) | SQL Editor ou CLI |
| ~~2.3~~ | ~~RLS~~ | **Reporté à l’étape 4** |
| **2.4** | Seeds + buckets Storage | SQL Editor |

---

## Sous-étape 2.1 — Créer le projet Supabase

### 1. Créer un compte et un projet

1. Allez sur [https://supabase.com](https://supabase.com)
2. Connectez-vous (GitHub ou email)
3. Cliquez **New project**
4. Renseignez :
   - **Name** : `ogefmeeting-dev` (ou `ogefmeeting-prod` plus tard)
   - **Database Password** : mot de passe fort — **notez-le**, vous en aurez besoin
   - **Region** : choisissez la plus proche (ex. `eu-west-1` pour l’Europe)
5. Cliquez **Create new project** — attendez 1 à 2 minutes

### 2. Récupérer les clés API

1. Dans le menu gauche : **Project Settings** (icône engrenage)
2. Onglet **API**
3. Copiez et conservez :

| Clé | Usage | Fichier |
|-----|-------|---------|
| **Project URL** | URL du projet | `SUPABASE_URL` / `VITE_SUPABASE_URL` |
| **anon public** | Frontend (publique) | `VITE_SUPABASE_ANON_KEY` |
| **service_role** | Backend uniquement (secrète) | `SUPABASE_SERVICE_ROLE_KEY` |

> Ne partagez jamais la clé `service_role`. Elle contourne toute sécurité.

### 3. Renseigner les fichiers `.env` locaux

**Backend** — `backend/.env` :
```env
SUPABASE_URL=https://VOTRE-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Frontend** — `frontend/.env` :
```env
VITE_SUPABASE_URL=https://VOTRE-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:4000
```

### 4. Modèle de données (référence)

Le schéma couvre **15 tables** + **2 vues** :

```
auth.users
    └── profils
            ├── reunions (created_by)
            ├── participants_reunion
            ├── actions (assignee_id)
            └── notifications

directions
    ├── profils
    └── reunions

modeles_compte_rendu
    └── reunions

reunions
    ├── points_ordre_jour
    ├── participants_reunion
    ├── enregistrements
    │       └── transcriptions
    │               └── segments_transcription
    ├── comptes_rendus
    │       └── versions_compte_rendu
    ├── decisions
    └── actions

empreintes_vocales → profils
journaux_audit
```

Diagramme détaillé : [schema-erd.md](./schema-erd.md)

---

## Sous-étape 2.2 — Appliquer les migrations SQL

Deux méthodes possibles. Choisissez **une seule**.

### Méthode A — SQL Editor (recommandée pour débuter)

1. Dashboard Supabase → **SQL Editor**
2. **New query**
3. Copiez-collez le contenu de :
   ```
   supabase/migrations/20260721140000_initial_schema.sql
   ```
4. Cliquez **Run** — vérifiez le message `Success`
5. Nouvelle requête → copiez-collez :
   ```
   supabase/migrations/20260721140100_storage_buckets.sql
   ```
6. Cliquez **Run**

### Méthode B — Supabase CLI (recommandée à long terme)

```powershell
# Installer la CLI (une fois)
npm install -g supabase

# Se connecter
supabase login

# À la racine Ogefmeeting/
cd Ogefmeeting
supabase link --project-ref VOTRE-REF

# Pousser les migrations
supabase db push
```

> `VOTRE-REF` = identifiant dans l’URL : `https://VOTRE-REF.supabase.co`

### Vérifier que le schéma est créé

1. Menu **Table Editor** — vous devez voir :
   - `directions`, `profils`, `reunions`, `comptes_rendus`, `actions`, etc.
2. Menu **Database** → **Types** — enums `role_utilisateur`, `statut_reunion`, etc.
3. Menu **Storage** — buckets pas encore visibles (étape 2.4)

---

## Sous-étape 2.4 — Seeds et Storage

### 1. Insérer les données initiales

1. **SQL Editor** → **New query**
2. Copiez-collez le contenu de `supabase/seed.sql`
3. **Run**

Vous obtenez :
- **6 directions** OGEFREM (DG, DGIT, DANTIC, etc.)
- **4 modèles** de comptes rendus (conseil de direction, technique, opérationnel, partenaires)

### 2. Vérifier les buckets Storage

Après la migration `20260721140100_storage_buckets.sql` :

1. Menu **Storage**
2. Buckets attendus :

| Bucket | Usage | Taille max | Public |
|--------|-------|------------|--------|
| `recordings` | Audio des réunions | 500 Mo | Non |
| `exports` | PDF exportés | 50 Mo | Non |
| `avatars` | Photos de profil | 5 Mo | Oui |

### 3. Créer un utilisateur test (optionnel)

1. Menu **Authentication** → **Users**
2. **Add user** → **Create new user**
3. Email + mot de passe
4. Le trigger SQL crée automatiquement une ligne dans `profiles`

Pour assigner un rôle admin :
```sql
UPDATE public.profils
SET role = 'administrateur', fonction = 'Administrateur système'
WHERE email = 'votre.email@ogefrem.cd';
```

---

## Vérification finale

### Test API locale

```powershell
cd Ogefmeeting
npm run dev:backend
```

Appelez : `http://localhost:4000/api/health`

Réponse attendue :
```json
{
  "supabase": "configured"
}
```

### Checklist étape 2

- [ ] Projet Supabase créé
- [ ] Clés copiées dans `backend/.env` et `frontend/.env`
- [ ] Migration schéma exécutée sans erreur
- [ ] Migration buckets exécutée
- [ ] Seed exécuté (directions + templates visibles)
- [ ] Utilisateur test créé (optionnel)
- [ ] API locale affiche `supabase: configured`

---

## Ce qui vient à l’étape 4 (pas maintenant)

- Activation **RLS** sur toutes les tables
- Politiques par rôle (admin, directeur, secrétaire, participant)
- Politiques Storage (qui peut uploader/lire les enregistrements)
- Connexion frontend via Supabase Auth

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `permission denied for schema auth` | Normal en local ; le trigger `handle_new_user` utilise `SECURITY DEFINER` |
| `type already exists` | Migration déjà exécutée — ignorez ou supprimez le projet et recommencez |
| `supabase: not_configured` | Vérifiez `SUPABASE_URL` et redémarrez le backend |
| Seed : `duplicate key` | Données déjà insérées — c’est normal (`ON CONFLICT DO NOTHING`) |

---

## Fichiers du projet

```
supabase/
├── migrations/
│   ├── 20260721140000_initial_schema.sql   ← Schéma complet
│   └── 20260721140100_storage_buckets.sql  ← Buckets Storage
├── seed.sql                                 ← Données initiales
└── README.md
```
