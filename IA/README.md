# Ogefmeeting — Laboratoire IA

Tests **Jupyter** avant intégration dans l'application (étape 10).

## Notebooks

| Fichier | Rôle |
|---------|------|
| `test-deepgram-stt-live.ipynb` | STT live Deepgram (micro → texte) |
| `test-cr-gpt.ipynb` | **Génération compte rendu GPT** (après réunion) |

## Module partagé

`ogefrem_context.py` — contexte OGEFREM, directions du siège + **12 provinciales/régionales**, organisation des réunions, prompts CR (réutilisable en backend).

Aide saisie 1ʳᵉ réunion réelle : `samples/reunion_test_saisie.md` (NOTE DANTIC → DPKIN).

## Installation

```bash
cd IA
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Remplir DEEPGRAM_API_KEY + OPENAI_API_KEY
jupyter lab
```

## Test CR rapide (terminal)

```bash
python test_cr_gpt.py
```

Sortie : `samples/brouillon_cr_exemple.json`

## Flux CR (notebook)

1. Métadonnées réunion (titre, type, directions, ODJ)
2. Transcription sauvegardée (`samples/` ou copiée depuis l'app)
3. GPT analyse l'intitulé puis rédige le JSON structuré
4. Si OK → intégration backend `POST /api/comptes-rendus/:id/generer-ia`
