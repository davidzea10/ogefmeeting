"""
Contexte métier OGEFREM pour la génération de comptes rendus (notebook + backend).
Structure : introduction → points ODJ (avec sous-points) → conclusion.
Trois niveaux : simple | detaille | tres_detaille
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

NiveauDetailCr = Literal["simple", "detaille", "tres_detaille"]

NIVEAUX_DETAIL_CR: list[NiveauDetailCr] = ["simple", "detaille", "tres_detaille"]

LIBELLES_NIVEAU_DETAIL: dict[NiveauDetailCr, str] = {
    "simple": "Compte rendu simple",
    "detaille": "Compte rendu détaillé",
    "tres_detaille": "Compte rendu très détaillé",
}

OGEFREM_PRESENTATION = """
L'OGEFREM (Office de Gestion du Fret Multimodal) est un établissement public de la RDC
chargé de la régulation, du contrôle et de la facilitation du fret maritime et multimodal.
Il délivre et supervise des instruments de traçabilité (FERI, AD, FERE), accompagne les
opérateurs du fret, et coordonne les directions techniques, commerciales, financières
et de contrôle interne.
""".strip()

DIRECTIONS_OGEFREM: list[dict[str, str]] = [
    {"code": "DG", "nom": "Direction Générale", "mission": "Pilotage stratégique et coordination institutionnelle de l'OGEFREM."},
    {"code": "DFM", "nom": "Direction du Fret Maritime", "mission": "Gestion et supervision du fret maritime."},
    {"code": "DTFM", "nom": "Direction du Transit et du Fret Multimodal", "mission": "Transit et fret multimodal."},
    {"code": "DFAC", "nom": "Direction des Facilitations et Affaires Commerciales", "mission": "Facilitation des opérations et affaires commerciales."},
    {"code": "DGIT", "nom": "Direction de Gestion des Instruments de Traçabilité", "mission": "Gestion FERI, AD, FERE et traçabilité du fret."},
    {"code": "DEP", "nom": "Direction des Études et de la Planification", "mission": "Études, planification et appui à la décision."},
    {"code": "DANTIC", "nom": "Direction de l'Application des NTIC", "mission": "Systèmes d'information, digitalisation et NTIC."},
    {"code": "DSG", "nom": "Direction du Secrétariat Général", "mission": "Secrétariat général et coordination administrative."},
    {"code": "DOCG", "nom": "Direction de l'Organisation et du Contrôle de Gestion", "mission": "Organisation, performance et contrôle de gestion."},
    {"code": "DRH", "nom": "Direction des Ressources Humaines", "mission": "Gestion du personnel et des compétences."},
    {"code": "DFIN", "nom": "Direction Financière", "mission": "Finances, comptabilité et budget."},
    {"code": "DAI", "nom": "Direction de l'Audit Interne", "mission": "Audit interne et conformité."},
    {"code": "DAJ", "nom": "Direction des Affaires Juridiques", "mission": "Conseil juridique et contentieux."},
    {"code": "DII", "nom": "Direction de l'Inspection et des Investigations", "mission": "Inspection et investigations."},
    {"code": "DSAERM", "nom": "Direction de la Sécurité des Affaires Extérieures et des Relations Multilatérales", "mission": "Sécurité extérieure et relations multilatérales."},
    {"code": "DRCP", "nom": "Direction des Relations avec les Chargeurs et Partenaires", "mission": "Relations avec chargeurs, mandataires et partenaires."},
]

# 12 directions provinciales / régionales (entités décentralisées)
DIRECTIONS_PROVINCIALES_OGEFREM: list[dict[str, str]] = [
    {"code": "DPKIN", "nom": "Direction Provinciale de Kinshasa", "mission": "Opérations OGEFREM à Kinshasa."},
    {"code": "DPO", "nom": "Direction Provinciale Ouest", "mission": "Opérations OGEFREM — Ouest (Kongo Central et environs)."},
    {"code": "DRGB", "nom": "Direction Régionale Grand Bandundu", "mission": "Opérations OGEFREM — Grand Bandundu."},
    {"code": "DRGE", "nom": "Direction Régionale Grand Equateur", "mission": "Opérations OGEFREM — Grand Equateur."},
    {"code": "DRGK", "nom": "Direction Régionale Grand Kasaï", "mission": "Opérations OGEFREM — Grand Kasaï."},
    {"code": "DRIHU", "nom": "Direction Régionale de l'Ituri et Haut-Uélé", "mission": "Opérations OGEFREM — Ituri et Haut-Uélé."},
    {"code": "DPMA", "nom": "Direction Provinciale du Maniema", "mission": "Opérations OGEFREM — Maniema."},
    {"code": "DPNK", "nom": "Direction Provinciale du Nord-Kivu", "mission": "Opérations OGEFREM — Nord-Kivu."},
    {"code": "DPSK", "nom": "Direction Provinciale du Sud-Kivu", "mission": "Opérations OGEFREM — Sud-Kivu."},
    {"code": "DRNK", "nom": "Direction Régionale Nord-Katanga", "mission": "Opérations OGEFREM — Nord-Katanga."},
    {"code": "DRSK", "nom": "Direction Régionale Sud-Katanga", "mission": "Opérations OGEFREM — Sud-Katanga / Haut-Katanga."},
    {"code": "DRTBU", "nom": "Direction Régionale de la Tshopo et Bas-Uélé", "mission": "Opérations OGEFREM — Tshopo et Bas-Uélé."},
]

ORGANISATION_REUNIONS_OGEFREM = """
COMMENT SONT ORGANISÉES LES RÉUNIONS À L'OGEFREM (contexte permanent) :
- Une réunion est souvent préparée par une NOTE interne (référence Direction/Service/N°)
  adressée à une ou plusieurs directions (ex. DANTIC → DPKIN), avec C.I. (copie info)
  à la Direction Générale (DG), au Directeur Général Adjoint (DGA) et à d'autres directions
  concernées (ex. DGIT).
- Le « Concerne » de la note devient le titre / objet de la réunion.
- Les métadonnées utiles : date et heure, lieu (salle, niveau, bâtiment du siège),
  directions liées (siège + éventuellement provinciale), contexte (report, suite d'une
  séance annulée, etc.) et objectifs (examiner, identifier les causes, convenir de mesures).
- Les réunions peuvent être multi-directions (siège ↔ direction provinciale / régionale).
- Hiérarchie des participants à respecter dans les listes et le CR :
  Directeur → Sous-directeur → Chef de service → Agent.
- Types fréquents : technique, opérationnel, conseil de direction, partenaires.
- L'ordre du jour structure le compte rendu : un point ODJ = un bloc du rapport.
- Ne pas inventer de faits absents de la transcription ; s'appuyer sur l'intitulé,
  les directions liées et l'ODJ pour cadrer le sens de la séance.
""".strip()

TYPES_REUNION_LIBELLES = {
    "conseil_direction": "Conseil de direction",
    "technique": "Réunion technique",
    "operationnel": "Point opérationnel",
    "partenaire": "Réunion partenaires / mandataires",
    "autre": "Autre",
}


def formater_directions_pour_prompt() -> str:
    lignes = ["### Directions du siège"]
    for d in DIRECTIONS_OGEFREM:
        lignes.append(f"- {d['code']} — {d['nom']} : {d['mission']}")
    lignes.append("### Directions provinciales et régionales (12 entités décentralisées)")
    for d in DIRECTIONS_PROVINCIALES_OGEFREM:
        lignes.append(f"- {d['code']} — {d['nom']} : {d['mission']}")
    return "\n".join(lignes)


def consignes_niveau(niveau: NiveauDetailCr, nb_mots: int) -> str:
    pages = max(1, min(5, round(nb_mots / 300)))
    if niveau == "simple":
        return f"""
NIVEAU DEMANDÉ : SIMPLE (compte rendu synthétique)
- Introduction courte (3-5 phrases).
- Pour CHAQUE point d'ordre du jour : 1 paragraphe d'introduction + sous-points obligatoires
  (1 à 2 phrases par sous-point : projet, dossier ou sujet cité).
- Conclusion brève (3-5 phrases).
- Viser environ {max(1, round(pages * 0.5))} page(s) A4.
- Ne pas omettre les noms de projets / dossiers mentionnés : un sous-point par élément."""
    if niveau == "tres_detaille":
        return f"""
NIVEAU DEMANDÉ : TRÈS DÉTAILLÉ (compte rendu exhaustif)
- Introduction complète (contexte, objectifs, participants, enjeux).
- Pour CHAQUE point d'ordre du jour : paragraphe d'introduction + TOUS les sous-points
  identifiables dans la transcription (chaque projet, dossier, thème, décision, chiffre,
  nom de personne ou organisation cité sous ce point).
- Chaque sous-point : développement en plusieurs phrases (faits, échanges, décisions,
  actions, remarques, échéances si mentionnées).
- Conclusion développée avec bilan et perspectives.
- Viser {max(2, pages + 1)} à {max(3, pages + 2)} page(s) A4.
- Règle d'or : ne RIEN omettre de la transcription rattachée à un point d'ordre du jour.
  Si 5 projets sont cités sous « Projets en cours », il faut 5 sous-points distincts."""
    return f"""
NIVEAU DEMANDÉ : DÉTAILLÉ (compte rendu standard)
- Introduction soignée (1 paragraphe).
- Pour CHAQUE point d'ordre du jour : paragraphe d'introduction + sous-points pour chaque
  projet, dossier ou sujet distinct mentionné (1 paragraphe par sous-point).
- Intégrer décisions, actions et remarques dans le texte des sous-points.
- Conclusion claire.
- Viser environ {max(1, pages)} à {max(2, pages + 1)} page(s) A4.
- Ne pas fusionner plusieurs projets dans un seul sous-point vague."""


@dataclass
class ContexteReunion:
    titre: str
    type_reunion: str = "technique"
    lieu: str | None = None
    date_reunion: str | None = None
    directions_codes: list[str] | None = None
    description: str | None = None
    participants: list[str] | None = None
    points_ordre_jour: list[str] | None = None


def construire_prompt_systeme() -> str:
    return f"""Tu es le rédacteur officiel de comptes rendus de l'OGEFREM (RDC).

{OGEFREM_PRESENTATION}

Directions de l'OGEFREM (code — nom — mission) :
{formater_directions_pour_prompt()}

{ORGANISATION_REUNIONS_OGEFREM}

STRUCTURE OBLIGATOIRE DU RAPPORT :
1. INTRODUCTION — cadre, intitulé, objectifs, participants.
2. POINTS DE L'ORDRE DU JOUR — un bloc par point de l'ODJ fourni, avec :
   - un paragraphe d'introduction du point (contenu du point) ;
   - des SOUS-POINTS (sous_points) : un élément par projet, dossier, thème ou sujet
     concret mentionné dans la transcription sous ce point d'ordre du jour.
     Exemple : si l'ODJ contient « Projets en cours » et que la transcription cite
     Ogefmeeting, FERI et Site web, tu dois créer 3 sous-points distincts.
3. CONCLUSION — bilan et perspectives.

RÈGLES CRITIQUES :
- L'ordre du jour est le plan du rapport : un point ODJ = un point du rapport.
- Relier chaque extrait de la transcription au bon point ODJ.
- Extraire TOUS les éléments clés (projets, noms propres, chiffres, décisions).
- Ne jamais inventer un fait absent de la transcription.
- Français administratif soigné.
- Répondre UNIQUEMENT en JSON valide."""


def construire_prompt_utilisateur(
    reunion: ContexteReunion,
    transcription: str,
    niveau: NiveauDetailCr = "detaille",
) -> str:
    type_libelle = TYPES_REUNION_LIBELLES.get(reunion.type_reunion, reunion.type_reunion)
    directions = ", ".join(reunion.directions_codes) if reunion.directions_codes else "Non précisé"
    participants = ", ".join(reunion.participants) if reunion.participants else "Non précisé"
    odj = "\n".join(f"- {p}" for p in (reunion.points_ordre_jour or [])) or "Non précisé"
    nb_mots = max(1, len(transcription.split()))

    return f"""Génère le rapport de réunion ci-dessous.

=== MÉTADONNÉES RÉUNION ===
Titre : {reunion.titre}
Type : {type_libelle} ({reunion.type_reunion})
Lieu : {reunion.lieu or 'Non précisé'}
Date : {reunion.date_reunion or 'Non précisée'}
Directions liées : {directions}
Description : {reunion.description or 'Non précisée'}
Participants : {participants}

Ordre du jour (plan strict du rapport — un bloc par ligne) :
{odj}

{consignes_niveau(niveau, nb_mots)}

=== TRANSCRIPTION (source principale — extraire tous les éléments) ===
{transcription.strip()}

Transcription ≈ {nb_mots} mots.

=== FORMAT JSON ATTENDU ===
{{
  "niveau_detail": "{niveau}",
  "directions_impliquees": ["DANTIC", "..."],
  "introduction": "...",
  "points_ordre_jour": [
    {{
      "titre": "Titre du point ODJ",
      "contenu": "Paragraphe d'introduction de ce point",
      "sous_points": [
        {{
          "titre": "Nom du projet / dossier / sujet (ex. Ogefmeeting)",
          "contenu": "Tout ce qui a été dit sur ce sous-sujet"
        }}
      ]
    }}
  ],
  "conclusion": "...",
  "avertissement": "Brouillon généré par IA — à valider par le secrétariat avant publication"
}}

Chaque point ODJ doit avoir au moins un sous_point si la transcription mentionne des éléments concrets."""


def max_tokens_pour_niveau(niveau: NiveauDetailCr) -> int:
    if niveau == "simple":
        return 4096
    if niveau == "tres_detaille":
        return 12000
    return 8000


def parser_reponse_json_brute(texte: str) -> dict[str, Any]:
    import json

    brut = texte.strip()
    if brut.startswith("```"):
        brut = brut.split("```", 2)[1]
        if brut.startswith("json"):
            brut = brut[4:]
        brut = brut.rsplit("```", 1)[0]
    return json.loads(brut.strip())
