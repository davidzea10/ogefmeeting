"""
Test génération compte rendu GPT (ligne de commande).
Usage : python test_cr_gpt.py [--niveau simple|detaille|tres_detaille]
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from ogefrem_context import (
    ContexteReunion,
    NiveauDetailCr,
    construire_prompt_systeme,
    construire_prompt_utilisateur,
    max_tokens_pour_niveau,
    parser_reponse_json_brute,
)

load_dotenv(Path(__file__).resolve().parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

if not OPENAI_API_KEY:
    raise SystemExit("OPENAI_API_KEY manquant dans IA/.env")

IA_DIR = Path(__file__).resolve().parent
SAMPLES = IA_DIR / "samples"
TRANSCRIPTION_PATH = SAMPLES / "transcription_exemple_dantic.txt"
OUTPUT_PATH = SAMPLES / "brouillon_cr_exemple.json"


def generer_brouillon_cr(
    reunion: ContexteReunion,
    transcription: str,
    niveau: NiveauDetailCr = "detaille",
) -> dict:
    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.25 if niveau == "tres_detaille" else 0.35,
        max_tokens=max_tokens_pour_niveau(niveau),
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": construire_prompt_systeme()},
            {
                "role": "user",
                "content": construire_prompt_utilisateur(reunion, transcription, niveau),
            },
        ],
    )
    contenu = resp.choices[0].message.content or "{}"
    return parser_reponse_json_brute(contenu)


def afficher_brouillon(brouillon: dict) -> None:
    print("=== INTRODUCTION ===")
    print(brouillon.get("introduction", ""))
    print("\n=== POINTS D'ORDRE DU JOUR ===")
    for i, point in enumerate(brouillon.get("points_ordre_jour") or [], 1):
        print(f"\n--- {i}. {point.get('titre', '')} ---")
        if point.get("contenu"):
            print(point.get("contenu"))
        for j, sp in enumerate(point.get("sous_points") or [], 1):
            print(f"\n  {i}.{j} {sp.get('titre', '')}")
            print(f"  {sp.get('contenu', '')}")
    print("\n=== CONCLUSION ===")
    print(brouillon.get("conclusion", ""))


def main() -> None:
    parser = argparse.ArgumentParser(description="Test génération CR GPT OGEFREM")
    parser.add_argument(
        "--niveau",
        choices=["simple", "detaille", "tres_detaille"],
        default="detaille",
        help="Niveau de détail du compte rendu",
    )
    args = parser.parse_args()
    niveau: NiveauDetailCr = args.niveau

    transcription = TRANSCRIPTION_PATH.read_text(encoding="utf-8")
    reunion = ContexteReunion(
        titre="Point d'avancement Ogefmeeting — transcription live et CR IA",
        type_reunion="technique",
        lieu="Salle DANTIC — Kinshasa",
        date_reunion="2026-08-24",
        directions_codes=["DANTIC", "DGIT"],
        description="Suivi du projet applicatif de gestion des réunions OGEFREM.",
        participants=[
            "David Debuze (DANTIC)",
            "Marie Kabongo (DANTIC)",
            "Jean-Pierre Mulumba (DANTIC)",
            "Grace Tshimanga (DGIT)",
        ],
        points_ordre_jour=[
            "Projets en cours",
            "Projets terminés",
            "Préparation démo direction",
        ],
    )

    print(f"Modèle : {OPENAI_MODEL}")
    print(f"Niveau : {niveau}")
    print(f"Réunion : {reunion.titre}\n")

    brouillon = generer_brouillon_cr(reunion, transcription, niveau)
    OUTPUT_PATH.write_text(json.dumps(brouillon, ensure_ascii=False, indent=2), encoding="utf-8")

    afficher_brouillon(brouillon)
    print(f"\nSauvegardé : {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
