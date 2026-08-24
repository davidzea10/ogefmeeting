/**
 * Génération de comptes rendus OGEFREM via OpenAI (GPT).
 * Structure : introduction → points ODJ (avec sous-points) → conclusion.
 * Trois niveaux : simple | detaille | tres_detaille
 */
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/errors.js';

export type NiveauDetailCr = 'simple' | 'detaille' | 'tres_detaille';

export const NIVEAUX_DETAIL_CR: NiveauDetailCr[] = [
  'simple',
  'detaille',
  'tres_detaille',
];

export const LIBELLES_NIVEAU_DETAIL: Record<NiveauDetailCr, string> = {
  simple: 'Compte rendu simple',
  detaille: 'Compte rendu détaillé',
  tres_detaille: 'Compte rendu très détaillé',
};

export type ContexteReunionIa = {
  titre: string;
  type_reunion: string;
  lieu?: string | null;
  date_reunion?: string | null;
  directions_codes?: string[];
  description?: string | null;
  participants?: string[];
  points_ordre_jour?: string[];
};

export type SousPointIa = {
  titre: string;
  contenu: string;
};

export type PointOrdreJourIa = {
  titre: string;
  contenu: string;
  sous_points: SousPointIa[];
};

export type BrouillonCrIa = {
  niveau_detail: NiveauDetailCr;
  directions_impliquees: string[];
  introduction: string;
  points_ordre_jour: PointOrdreJourIa[];
  conclusion: string;
  avertissement: string;
};

const OGEFREM_PRESENTATION = `
L'OGEFREM (Office de Gestion du Fret Multimodal) est un établissement public de la RDC
chargé de la régulation, du contrôle et de la facilitation du fret maritime et multimodal.
Il délivre et supervise des instruments de traçabilité (FERI, AD, FERE), accompagne les
opérateurs du fret, et coordonne les directions techniques, commerciales, financières
et de contrôle interne.
`.trim();

const DIRECTIONS_OGEFREM: Array<{ code: string; nom: string; mission: string }> = [
  { code: 'DG', nom: 'Direction Générale', mission: "Pilotage stratégique et coordination institutionnelle de l'OGEFREM." },
  { code: 'DFM', nom: 'Direction du Fret Maritime', mission: 'Gestion et supervision du fret maritime.' },
  { code: 'DTFM', nom: 'Direction du Transit et du Fret Multimodal', mission: 'Transit et fret multimodal.' },
  { code: 'DFAC', nom: 'Direction des Facilitations et Affaires Commerciales', mission: 'Facilitation des opérations et affaires commerciales.' },
  { code: 'DGIT', nom: 'Direction de Gestion des Instruments de Traçabilité', mission: 'Gestion FERI, AD, FERE et traçabilité du fret.' },
  { code: 'DEP', nom: 'Direction des Études et de la Planification', mission: 'Études, planification et appui à la décision.' },
  { code: 'DANTIC', nom: "Direction de l'Application des NTIC", mission: "Systèmes d'information, digitalisation et NTIC." },
  { code: 'DSG', nom: 'Direction du Secrétariat Général', mission: 'Secrétariat général et coordination administrative.' },
  { code: 'DOCG', nom: "Direction de l'Organisation et du Contrôle de Gestion", mission: 'Organisation, performance et contrôle de gestion.' },
  { code: 'DRH', nom: 'Direction des Ressources Humaines', mission: 'Gestion du personnel et des compétences.' },
  { code: 'DFIN', nom: 'Direction Financière', mission: 'Finances, comptabilité et budget.' },
  { code: 'DAI', nom: "Direction de l'Audit Interne", mission: 'Audit interne et conformité.' },
  { code: 'DAJ', nom: 'Direction des Affaires Juridiques', mission: 'Conseil juridique et contentieux.' },
  { code: 'DII', nom: "Direction de l'Inspection et des Investigations", mission: 'Inspection et investigations.' },
  { code: 'DSAERM', nom: 'Direction de la Sécurité des Affaires Extérieures et des Relations Multilatérales', mission: 'Sécurité extérieure et relations multilatérales.' },
  { code: 'DRCP', nom: 'Direction des Relations avec les Chargeurs et Partenaires', mission: 'Relations avec chargeurs, mandataires et partenaires.' },
];

const TYPES_REUNION_LIBELLES: Record<string, string> = {
  conseil_direction: 'Conseil de direction',
  technique: 'Réunion technique',
  operationnel: 'Point opérationnel',
  partenaire: 'Réunion partenaires / mandataires',
  autre: 'Autre',
};

function formaterDirections(): string {
  return DIRECTIONS_OGEFREM.map((d) => `- ${d.code} — ${d.nom} : ${d.mission}`).join('\n');
}

function consignesNiveau(niveau: NiveauDetailCr, nbMots: number): string {
  const pages = Math.max(1, Math.min(5, Math.round(nbMots / 300)));
  switch (niveau) {
    case 'simple':
      return `
NIVEAU DEMANDÉ : SIMPLE (compte rendu synthétique)
- Introduction courte (3-5 phrases).
- Pour CHAQUE point d'ordre du jour : 1 paragraphe d'introduction + sous-points obligatoires
  (1 à 2 phrases par sous-point : projet, dossier ou sujet cité).
- Conclusion brève (3-5 phrases).
- Viser environ ${Math.max(1, Math.round(pages * 0.5))} page(s) A4.
- Ne pas omettre les noms de projets / dossiers mentionnés : un sous-point par élément.`;
    case 'tres_detaille':
      return `
NIVEAU DEMANDÉ : TRÈS DÉTAILLÉ (compte rendu exhaustif)
- Introduction complète (contexte, objectifs, participants, enjeux).
- Pour CHAQUE point d'ordre du jour : paragraphe d'introduction + TOUS les sous-points
  identifiables dans la transcription (chaque projet, dossier, thème, décision, chiffre,
  nom de personne ou organisation cité sous ce point).
- Chaque sous-point : développement en plusieurs phrases (faits, échanges, décisions,
  actions, remarques, échéances si mentionnées).
- Conclusion développée avec bilan et perspectives.
- Viser ${Math.max(2, pages + 1)} à ${Math.max(3, pages + 2)} page(s) A4.
- Règle d'or : ne RIEN omettre de la transcription rattachée à un point d'ordre du jour.
  Si 5 projets sont cités sous « Projets en cours », il faut 5 sous-points distincts.`;
    default:
      return `
NIVEAU DEMANDÉ : DÉTAILLÉ (compte rendu standard)
- Introduction soignée (1 paragraphe).
- Pour CHAQUE point d'ordre du jour : paragraphe d'introduction + sous-points pour chaque
  projet, dossier ou sujet distinct mentionné (1 paragraphe par sous-point).
- Intégrer décisions, actions et remarques dans le texte des sous-points.
- Conclusion claire.
- Viser environ ${Math.max(1, pages)} à ${Math.max(2, pages + 1)} page(s) A4.
- Ne pas fusionner plusieurs projets dans un seul sous-point vague.`;
  }
}

export function construirePromptSysteme(): string {
  return `Tu es le rédacteur officiel de comptes rendus de l'OGEFREM (RDC).

${OGEFREM_PRESENTATION}

Directions de l'OGEFREM (code — nom — mission) :
${formaterDirections()}

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
- Répondre UNIQUEMENT en JSON valide.`;
}

export function construirePromptUtilisateur(
  reunion: ContexteReunionIa,
  transcription: string,
  niveau: NiveauDetailCr = 'detaille',
): string {
  const typeLibelle = TYPES_REUNION_LIBELLES[reunion.type_reunion] ?? reunion.type_reunion;
  const directions = reunion.directions_codes?.length
    ? reunion.directions_codes.join(', ')
    : 'Non précisé';
  const participants = reunion.participants?.length
    ? reunion.participants.join(', ')
    : 'Non précisé';
  const odj = reunion.points_ordre_jour?.length
    ? reunion.points_ordre_jour.map((p) => `- ${p}`).join('\n')
    : 'Non précisé';
  const nbMots = Math.max(1, transcription.trim().split(/\s+/).length);

  return `Génère le rapport de réunion ci-dessous.

=== MÉTADONNÉES RÉUNION ===
Titre : ${reunion.titre}
Type : ${typeLibelle} (${reunion.type_reunion})
Lieu : ${reunion.lieu || 'Non précisé'}
Date : ${reunion.date_reunion || 'Non précisée'}
Directions liées : ${directions}
Description : ${reunion.description || 'Non précisée'}
Participants : ${participants}

Ordre du jour (plan strict du rapport — un bloc par ligne) :
${odj}

${consignesNiveau(niveau, nbMots)}

=== TRANSCRIPTION (source principale — extraire tous les éléments) ===
${transcription.trim()}

Transcription ≈ ${nbMots} mots.

=== FORMAT JSON ATTENDU ===
{
  "niveau_detail": "${niveau}",
  "directions_impliquees": ["DANTIC", "..."],
  "introduction": "...",
  "points_ordre_jour": [
    {
      "titre": "Titre du point ODJ",
      "contenu": "Paragraphe d'introduction de ce point",
      "sous_points": [
        {
          "titre": "Nom du projet / dossier / sujet (ex. Ogefmeeting)",
          "contenu": "Tout ce qui a été dit sur ce sous-sujet"
        }
      ]
    }
  ],
  "conclusion": "...",
  "avertissement": "Brouillon généré par IA — à valider par le secrétariat avant publication"
}

Chaque point ODJ doit avoir au moins un sous_point si la transcription mentionne des éléments concrets.`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function normaliserSousPoint(raw: unknown): SousPointIa | null {
  if (!raw || typeof raw !== 'object') return null;
  const sp = raw as Record<string, unknown>;
  const titre = String(sp.titre ?? sp.nom ?? '').trim();
  const contenu = String(sp.contenu ?? sp.developpement ?? sp.texte ?? '').trim();
  if (!titre && !contenu) return null;
  return {
    titre: titre || 'Élément',
    contenu,
  };
}

function normaliserPoint(raw: unknown): PointOrdreJourIa | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const titre = String(p.titre ?? '').trim();
  const contenu = String(p.contenu ?? p.developpement ?? p.introduction ?? '').trim();
  const sousPointsRaw = p.sous_points ?? p.sousPoints ?? p.elements ?? [];
  const sous_points = Array.isArray(sousPointsRaw)
    ? sousPointsRaw.map(normaliserSousPoint).filter((sp): sp is SousPointIa => sp !== null)
    : [];

  if (!titre && !contenu && sous_points.length === 0) return null;

  return {
    titre: titre || 'Point sans titre',
    contenu,
    sous_points,
  };
}

export function parserBrouillonCrIa(texte: string, niveauFallback: NiveauDetailCr): BrouillonCrIa {
  let brut = texte.trim();
  if (brut.startsWith('```')) {
    const parts = brut.split('```');
    brut = parts[1] ?? brut;
    if (brut.startsWith('json')) brut = brut.slice(4);
  }
  const parsed = JSON.parse(brut.trim()) as Record<string, unknown>;
  const points = Array.isArray(parsed.points_ordre_jour)
    ? parsed.points_ordre_jour.map(normaliserPoint).filter((p): p is PointOrdreJourIa => p !== null)
    : [];

  const niveauRaw = String(parsed.niveau_detail ?? niveauFallback);
  const niveau_detail = NIVEAUX_DETAIL_CR.includes(niveauRaw as NiveauDetailCr)
    ? (niveauRaw as NiveauDetailCr)
    : niveauFallback;

  return {
    niveau_detail,
    directions_impliquees: asStringArray(parsed.directions_impliquees),
    introduction: String(parsed.introduction ?? parsed.synthese ?? '').trim(),
    points_ordre_jour: points,
    conclusion: String(parsed.conclusion ?? '').trim(),
    avertissement: String(
      parsed.avertissement ??
        'Brouillon généré par IA — à valider par le secrétariat avant publication',
    ).trim(),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphsHtml(text: string): string {
  const parts = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

export function pointsOrdreJourVersHtml(points: PointOrdreJourIa[]): string {
  if (!points.length) return '<p><em>Aucun point d’ordre du jour traité.</em></p>';
  return points
    .map((point, index) => {
      const num = index + 1;
      let html = `<h3>${num}. ${escapeHtml(point.titre)}</h3>`;
      if (point.contenu) {
        html += paragraphsHtml(point.contenu);
      }
      if (point.sous_points.length > 0) {
        for (let j = 0; j < point.sous_points.length; j++) {
          const sp = point.sous_points[j];
          html += `<h4>${num}.${j + 1} ${escapeHtml(sp.titre)}</h4>`;
          html += paragraphsHtml(sp.contenu) || '<p></p>';
        }
      } else if (!point.contenu) {
        html += '<p><em>Aucun élément détaillé pour ce point.</em></p>';
      }
      return html;
    })
    .join('\n');
}

export function brouillonVersContenuSections(
  brouillon: BrouillonCrIa,
  sectionsCles: string[],
  participantsHtml?: string,
): Record<string, string> {
  const niveauLibelle = LIBELLES_NIVEAU_DETAIL[brouillon.niveau_detail];
  const introHtml =
    paragraphsHtml(brouillon.introduction) +
    `<p><em>${escapeHtml(niveauLibelle)}</em></p>`;
  const pointsHtml = pointsOrdreJourVersHtml(brouillon.points_ordre_jour);
  const conclusionParts = [brouillon.conclusion, brouillon.avertissement].filter(Boolean);
  const conclusionHtml = paragraphsHtml(conclusionParts.join('\n\n'));

  const mapping: Record<string, string> = {
    contexte: introHtml,
    synthese: introHtml,
    introduction: introHtml,
    ordre_du_jour: pointsHtml,
    points_techniques: pointsHtml,
    echanges: pointsHtml,
    operations: pointsHtml,
    conclusion: conclusionHtml,
    prochaine_reunion: conclusionHtml,
    suivi: conclusionHtml,
    risques: '<p></p>',
    blocages: '<p></p>',
    accords: '<p></p>',
    decisions: '<p></p>',
    actions: '<p></p>',
  };

  if (participantsHtml) {
    mapping.participants = participantsHtml;
  }

  const contenu: Record<string, string> = {};
  for (const cle of sectionsCles) {
    contenu[cle] = mapping[cle] ?? '<p></p>';
  }
  return contenu;
}

function maxTokensPourNiveau(niveau: NiveauDetailCr): number {
  switch (niveau) {
    case 'simple':
      return 4096;
    case 'tres_detaille':
      return 12000;
    default:
      return 8000;
  }
}

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export class CrIaService {
  assurerConfigure(): void {
    if (!env.OPENAI_API_KEY) {
      throw new AppError(
        503,
        'Génération IA indisponible : définissez OPENAI_API_KEY dans le backend (.env).',
      );
    }
  }

  async genererBrouillon(
    reunion: ContexteReunionIa,
    transcription: string,
    niveau: NiveauDetailCr = 'detaille',
  ): Promise<BrouillonCrIa> {
    this.assurerConfigure();
    const texte = transcription.trim();
    if (texte.length < 40) {
      throw new AppError(
        400,
        'Transcription trop courte pour générer un compte rendu. Sauvegardez d’abord le texte STT.',
      );
    }

    const model = env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: niveau === 'tres_detaille' ? 0.25 : 0.35,
        max_tokens: maxTokensPourNiveau(niveau),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: construirePromptSysteme() },
          { role: 'user', content: construirePromptUtilisateur(reunion, texte, niveau) },
        ],
      }),
    });

    const payload = (await response.json()) as OpenAiChatResponse;
    if (!response.ok) {
      const detail = payload.error?.message ?? `HTTP ${response.status}`;
      logger.error({ detail, status: response.status }, 'Échec appel OpenAI CR');
      throw new AppError(502, `OpenAI a refusé la génération : ${detail}`);
    }

    const contenu = payload.choices?.[0]?.message?.content;
    if (!contenu) {
      throw new AppError(502, 'Réponse OpenAI vide.');
    }

    try {
      return parserBrouillonCrIa(contenu, niveau);
    } catch (err) {
      logger.error({ err, contenu: contenu.slice(0, 400) }, 'JSON CR IA invalide');
      throw new AppError(502, 'Le modèle a renvoyé un JSON invalide.');
    }
  }
}

export const crIaService = new CrIaService();
