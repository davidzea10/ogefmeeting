# Supabase — Ogefmeeting

Configuration base de données PostgreSQL via Supabase.

## Guide complet

Voir **[docs/supabase-setup.md](../docs/supabase-setup.md)** pour les instructions pas à pas sur le dashboard Supabase.

## Fichiers

| Fichier | Description |
|---------|-------------|
| `migrations/20260721140000_initial_schema.sql` | Schéma complet (15 tables FR, 2 vues) |
| `migrations/20260721140100_storage_buckets.sql` | Buckets Storage |
| `seed.sql` | Directions OGEFREM + modèles de CR |

## Application rapide (SQL Editor)

1. Exécuter `20260721140000_initial_schema.sql`
2. Exécuter `20260721140100_storage_buckets.sql`
3. Exécuter `seed.sql`

## RLS

La sécurité Row Level Security sera configurée à l'**étape 4** (Authentification).

## Schéma

Diagramme et documentation : [docs/schema-erd.md](../docs/schema-erd.md)
