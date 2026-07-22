# Backend — Ogefmeeting API

API REST Node.js (Express + TypeScript) — architecture **MVC**.

## Architecture MVC

```
Requête HTTP
    ↓
routes/          → déclare les endpoints
    ↓
middleware/      → validation Zod (auth JWT → étape 4)
    ↓
controllers/     → lit la requête, appelle le service, renvoie la réponse
    ↓
services/        → logique métier + accès Supabase (couche Model)
    ↓
Réponse JSON
```

## Structure

```
src/
├── config/           # Variables d'environnement
├── controllers/      # Contrôleurs (HTTP)
├── services/         # Services métier
├── routes/           # Définition des routes
├── middleware/       # validate, erreurs, async, 404
├── schemas/          # Schémas Zod
├── types/            # Types locaux API
├── lib/              # Clients (Supabase, logger)
├── utils/            # AppError, mapping erreurs Supabase
├── app.ts
└── index.ts
```

## Étape 3.1 — Fondations

- [x] Express + TypeScript
- [x] Structure MVC
- [x] CORS, Helmet, compression, rate limiting
- [x] Erreurs centralisées + logger Pino

## Étape 3.2 — Supabase + validation

- [x] Client Supabase service_role (`getSupabaseAdmin` / `requireSupabaseAdmin`)
- [x] Mapping des erreurs PostgREST → `AppError`
- [x] Validation des entrées avec Zod (`validateBody`, `validateQuery`, `validateParams`)
- [x] Middleware JWT Auth
- [x] Middleware RBAC (`requirePermission` + matrice par rôle)

## Étape 4 — Auth, profils, RBAC, audit (4.1 sautée)

- [x] **4.1** Configuration Supabase Auth — *déjà faite, non refaite*
- [x] **4.2** Trigger `apres_creation_utilisateur_auth` → table `profils`
- [x] **4.2** `GET/PUT /api/profil` — consulter / modifier son profil
- [x] **4.2** `POST /api/utilisateurs/inviter` — invitation admin
- [x] **4.3** Matrice RBAC (`utils/permissions.ts`) + `requirePermission` sur toutes les routes métier
- [x] **4.3** Tests unitaires matrice RBAC (`npm test`)
- [x] **4.4** Journal connexions / déconnexions / invitations dans `journaux_audit`
- [x] **4.4** `POST /api/auth/mot-de-passe` et `/mot-de-passe/oublie`
- [x] **4.4** Comptes désactivés ignorés par `attachAuth`
- [ ] Refresh token automatique côté frontend — **étape 5+**

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/profil` | Mon profil + permissions |
| PUT | `/api/profil` | Modifier mon profil (sans changer le rôle) |
| POST | `/api/utilisateurs/inviter` | Inviter un utilisateur (admin) |
| PUT | `/api/utilisateurs/:id` | Modifier un profil (admin) |
| POST | `/api/utilisateurs/:id/desactiver` | Désactiver un compte (admin) |
| GET | `/api/audit` | Journal d'audit (admin, directeur) |
| POST | `/api/auth/mot-de-passe` | Changer son mot de passe |
| POST | `/api/auth/mot-de-passe/oublie` | Demande de réinitialisation |

Quand `AUTH_ENFORCED=true` : toutes les routes métier exigent un JWT valide et la permission associée. L'inscription publique est réservée à l'administrateur ; les autres comptes passent par `/api/utilisateurs/inviter`.

## Auth JWT (mode non bloquant par défaut)

- [x] Middleware `attachAuth` (JWT optionnel)
- [x] `requireAuth` / `requireRoles` / `requirePermission` — actifs **seulement** si `AUTH_ENFORCED=true`
- [x] Routes `/api/auth` : inscription, connexion, moi, rafraîchir, déconnexion
- [x] Défaut : `AUTH_ENFORCED=false` → pas de contrainte au déploiement / usage

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/inscription` | Créer un compte (admin si AUTH_ENFORCED) |
| POST | `/api/auth/connexion` | Login → access_token + refresh_token |
| POST | `/api/auth/rafraichir` | Renouveler le token |
| GET | `/api/auth/moi` | Profil courant (ou message si non connecté) |
| POST | `/api/auth/deconnexion` | Invalider la session (best effort) |

Header : `Authorization: Bearer <access_token>`

## Étape 3.3 — API Réunions

- [x] CRUD réunions (`/api/reunions`)
- [x] Démarrer / clôturer
- [x] Participants (`PUT /:id/participants`)
- [x] Ordre du jour (`PUT /:id/ordre-du-jour`)
- [x] Soft delete = archivage (`DELETE /:id` → statut `archivee`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/reunions` | Liste (pagination, filtres) |
| POST | `/api/reunions` | Créer |
| GET | `/api/reunions/:id` | Détail + participants + ODJ |
| PUT | `/api/reunions/:id` | Modifier |
| DELETE | `/api/reunions/:id` | Archiver |
| POST | `/api/reunions/:id/demarrer` | Démarrer |
| POST | `/api/reunions/:id/cloturer` | Clôturer |
| PUT | `/api/reunions/:id/participants` | Remplacer participants |
| PUT | `/api/reunions/:id/ordre-du-jour` | Remplacer ordre du jour |

## Étape 3.4 — Comptes rendus, actions, admin, recherche

- [x] CRUD comptes rendus + soumettre / valider / rejeter / versions
- [x] Export HTML (`/export` — PDF binaire à l'étape 8)
- [x] CRUD actions et décisions
- [x] Directions, profils, modèles de CR
- [x] Recherche globale `GET /api/recherche?q=`

| Préfixe | Description |
|---------|-------------|
| `/api/comptes-rendus` | Comptes rendus + workflow validation |
| `/api/actions` | Actions de suivi |
| `/api/decisions` | Décisions formelles |
| `/api/directions` | Directions OGEFREM |
| `/api/profils` | Utilisateurs / profils |
| `/api/modeles-compte-rendu` | Modèles de CR |
| `/api/recherche` | Recherche multi-entités |

## Démarrage

```bash
cp .env.example .env
npm run dev
```

API : `http://localhost:4000`  
Health : `GET /api/health`

## Exemple validation Zod (pour les prochaines routes)

```ts
import { validateBody, validateParams } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler((req, res) => controller.getById(req, res)),
);
```
