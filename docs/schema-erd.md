# Schéma de données — Ogefmeeting

> Tables, **colonnes** et **valeurs d'enums** en français.

## Enums — valeurs

| Enum | Valeurs |
|------|---------|
| `role_utilisateur` | administrateur, directeur, secretaire, participant, lecteur |
| `statut_reunion` | planifiee, en_cours, cloturee, archivee |
| `type_reunion` | conseil_direction, technique, operationnel, partenaire, autre |
| `statut_compte_rendu` | brouillon, soumis, en_revision, valide, archive |
| `priorite_action` | basse, moyenne, haute, critique |
| `statut_action` | en_attente, en_cours, terminee, annulee, en_retard |
| `statut_participant` | invite, confirme, present, absent |
| `statut_transcription` | en_attente, en_traitement, terminee, echouee |

## Colonnes communes

| Colonne | Signification |
|---------|---------------|
| `cree_le` | Date de création |
| `modifie_le` | Date de dernière modification |
| `cree_par` | Utilisateur créateur |
| `statut` | État courant de l'enregistrement |

## Exemple — table `profils`

| Colonne | Type | Description |
|---------|------|-------------|
| `prenom` | TEXT | Prénom |
| `nom` | TEXT | Nom de famille |
| `fonction` | TEXT | Poste / fonction |
| `url_avatar` | TEXT | URL photo de profil |
| `role` | role_utilisateur | Rôle applicatif |
| `est_actif` | BOOLEAN | Compte actif |

## Exemple — table `reunions`

| Colonne | Type | Description |
|---------|------|-------------|
| `titre` | TEXT | Titre de la réunion |
| `type_reunion` | type_reunion | Type (conseil, technique…) |
| `statut` | statut_reunion | planifiee, en_cours… |
| `date_prevue` | TIMESTAMPTZ | Date/heure planifiée |
| `date_debut` | TIMESTAMPTZ | Début effectif |
| `date_fin` | TIMESTAMPTZ | Fin effective |
| `lieu` | TEXT | Salle ou lieu |
| `modele_id` | UUID | Modèle de compte rendu |

## Tables

| Table | Description |
|-------|-------------|
| `directions` | Directions OGEFREM |
| `profils` | Utilisateurs |
| `modeles_compte_rendu` | Modèles de CR |
| `reunions` | Réunions |
| `participants_reunion` | Participants |
| `points_ordre_jour` | Ordre du jour |
| `enregistrements` | Fichiers audio |
| `comptes_rendus` | Comptes rendus |
| `versions_compte_rendu` | Historique CR |
| `decisions` | Décisions |
| `actions` | Actions de suivi |
| `transcriptions` | Transcriptions IA |
| `segments_transcription` | Segments IA |
| `empreintes_vocales` | Voix enregistrées |
| `notifications` | Notifications |
| `journaux_audit` | Audit |

## Vues

| Vue | Description |
|-----|-------------|
| `reunions_avec_statistiques` | Stats participants / enregistrements |
| `actions_en_attente` | Actions non terminées |
