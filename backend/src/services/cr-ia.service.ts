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

/** 12 directions provinciales / régionales (entités décentralisées). */
const DIRECTIONS_PROVINCIALES_OGEFREM: Array<{
  code: string;
  nom: string;
  mission: string;
}> = [
  { code: 'DPKIN', nom: 'Direction Provinciale de Kinshasa', mission: 'Opérations OGEFREM à Kinshasa.' },
  { code: 'DPO', nom: 'Direction Provinciale Ouest', mission: 'Opérations OGEFREM — Ouest (Kongo Central et environs).' },
  { code: 'DRGB', nom: 'Direction Régionale Grand Bandundu', mission: 'Opérations OGEFREM — Grand Bandundu.' },
  { code: 'DRGE', nom: 'Direction Régionale Grand Equateur', mission: 'Opérations OGEFREM — Grand Equateur.' },
  { code: 'DRGK', nom: 'Direction Régionale Grand Kasaï', mission: 'Opérations OGEFREM — Grand Kasaï.' },
  { code: 'DRIHU', nom: "Direction Régionale de l'Ituri et Haut-Uélé", mission: 'Opérations OGEFREM — Ituri et Haut-Uélé.' },
  { code: 'DPMA', nom: 'Direction Provinciale du Maniema', mission: 'Opérations OGEFREM — Maniema.' },
  { code: 'DPNK', nom: 'Direction Provinciale du Nord-Kivu', mission: 'Opérations OGEFREM — Nord-Kivu.' },
  { code: 'DPSK', nom: 'Direction Provinciale du Sud-Kivu', mission: 'Opérations OGEFREM — Sud-Kivu.' },
  { code: 'DRNK', nom: 'Direction Régionale Nord-Katanga', mission: 'Opérations OGEFREM — Nord-Katanga.' },
  { code: 'DRSK', nom: 'Direction Régionale Sud-Katanga', mission: 'Opérations OGEFREM — Sud-Katanga / Haut-Katanga.' },
  { code: 'DRTBU', nom: 'Direction Régionale de la Tshopo et Bas-Uélé', mission: 'Opérations OGEFREM — Tshopo et Bas-Uélé.' },
];

const ORGANISATION_REUNIONS_OGEFREM = `
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
`.trim();

const TYPES_REUNION_LIBELLES: Record<string, string> = {
  conseil_direction: 'Conseil de direction',
  technique: 'Réunion technique',
  operationnel: 'Point opérationnel',
  partenaire: 'Réunion partenaires / mandataires',
  autre: 'Autre',
};

function formaterDirections(): string {
  const siege = DIRECTIONS_OGEFREM.map(
    (d) => `- ${d.code} — ${d.nom} : ${d.mission}`,
  ).join('\n');
  const provinciales = DIRECTIONS_PROVINCIALES_OGEFREM.map(
    (d) => `- ${d.code} — ${d.nom} : ${d.mission}`,
  ).join('\n');
  return `### Directions du siège\n${siege}\n### Directions provinciales et régionales (12 entités décentralisées)\n${provinciales}`;
}

function consignesNiveau(niveau: NiveauDetailCr, nbMots: number): string {
  // Volume cible ≈ 2× les anciennes consignes (rapport administratif dense type OGEFREM)
  const pages = Math.max(2, Math.min(14, Math.round((nbMots * 2) / 280)));
  switch (niveau) {
    case 'simple':
      return `
NIVEAU DEMANDÉ : SIMPLE (synthèse structurée mais complète — volume ×2 vs ancien simple)
- Introduction développée (8 à 12 phrases) : contexte, objectifs, déroulement, directions.
- Pour CHAQUE point d’ordre du jour : paragraphe d’introduction + TOUS les sous-points
  (chaque projet, dossier, thème, décision, chiffre).
- Chaque sous-point : 5 à 8 phrases (faits, échanges, décisions, actions, échéances).
- Conclusion (8 à 12 phrases).
- Viser ${Math.max(3, pages)} à ${Math.max(5, pages + 1)} page(s) A4.
- Couvrir tous les éléments essentiels ; un CR trop court est une erreur.`;
    case 'tres_detaille':
      return `
NIVEAU DEMANDÉ : TRÈS DÉTAILLÉ — rapport administratif EXHAUSTIF (modèle OGEFREM type « Rapport relatif à… »)
VOLUME OBLIGATOIRE (non négociable) :
- Chaque SOUS-POINT : MINIMUM 150 mots (viser 180 à 250 mots). Compter les mots.
- Intro de chaque grand point : MINIMUM 120 mots.
- Conclusion : MINIMUM 200 mots.
- Introduction générale : MINIMUM 150 mots.
Un texte trop court = échec. Développer les échanges, reformuler ce qui a été dit, citer les éléments techniques.

STRUCTURE OBLIGATOIRE EN CHIFFRES ROMAINS :
I. Objectifs de la réunion (1er élément de points_ordre_jour, titre EXACT)
II. III. IV. … thèmes abordés dans la transcription
Conclusion dans le champ « conclusion »

Style : français administratif, paragraphes longs (pas de listes sèches, pas de résumé télégraphique).
Relater clairement ce qui a été présenté, demandé, répondu et décidé.
Ne RIEN omettre de la transcription. Ne pas inventer.

Viser ${Math.max(8, pages + 3)} à ${Math.max(14, pages + 6)} page(s) A4.`;
    default:
      return `
NIVEAU DEMANDÉ : DÉTAILLÉ (standard OGEFREM — volume ×2)
- Introduction soignée (10 à 16 phrases).
- Pour CHAQUE point ODJ : intro + sous-points (un élément concret = un sous-point).
- Chaque sous-point : 6 à 12 phrases (faits, échanges, décisions, actions, chiffres, échéances).
- Conclusion développée (10 à 16 phrases).
- Viser ${Math.max(5, pages + 1)} à ${Math.max(8, pages + 3)} page(s) A4.`;
  }
}

export function construirePromptSysteme(): string {
  return `Tu es le rédacteur officiel de comptes rendus de l'OGEFREM (RDC).

${OGEFREM_PRESENTATION}

Directions de l'OGEFREM (code — nom — mission) :
${formaterDirections()}

${ORGANISATION_REUNIONS_OGEFREM}

STRUCTURE OBLIGATOIRE DU RAPPORT :
1. INTRODUCTION — contexte et déroulement (sans recopier titre/date/lieu/type déjà en en-tête).
2. POINTS DE L'ORDRE DU JOUR — un bloc par point, avec sous-points concrets.
   En mode TRÈS DÉTAILLÉ : le 1er point s’intitule obligatoirement « Objectifs de la réunion »
   (chiffre romain I.), puis les thèmes abordés (II., III., …), style rapport administratif OGEFREM.
3. CONCLUSION — bilan, dispositions retenues, perspectives.

RÈGLES CRITIQUES :
- L'ordre du jour (ou les thèmes extraits de la transcription) structure le rapport.
- Relater brièvement mais clairement ce qui a été dit / présenté / discuté.
- Extraire TOUS les éléments clés. Un compte rendu trop court est une erreur grave.
- Ne jamais inventer un fait absent de la transcription.
- Français administratif soigné (paragraphes développés, pas de style télégraphique).
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

RAPPEL : l'introduction ne doit pas recopier le titre, la date, le lieu ou le type — déjà visibles en en-tête.
${
  niveau === 'tres_detaille'
    ? 'RAPPEL TRÈS DÉTAILLÉ : le premier objet de points_ordre_jour doit avoir titre « Objectifs de la réunion » ; les titres suivants sont les thèmes abordés ; volume dense, paragraphes longs.'
    : ''
}

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
  "conclusion": "..."
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

export function pointsOrdreJourVersHtml(
  points: PointOrdreJourIa[],
  options?: { chiffresRomains?: boolean },
): string {
  if (!points.length) return '<p><em>Aucun point d’ordre du jour traité.</em></p>';
  const romains = [
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
    'XI',
    'XII',
    'XIII',
    'XIV',
    'XV',
  ];
  return points
    .map((point, index) => {
      const num = options?.chiffresRomains
        ? `${romains[index] ?? String(index + 1)}.`
        : `${index + 1}.`;
      let html = `<h3>${num} ${escapeHtml(point.titre)}</h3>`;
      if (point.contenu) {
        html += paragraphsHtml(point.contenu);
      }
      if (point.sous_points.length > 0) {
        for (let j = 0; j < point.sous_points.length; j++) {
          const sp = point.sous_points[j];
          const subNum = options?.chiffresRomains
            ? `${romains[index] ?? index + 1}.${j + 1}`
            : `${index + 1}.${j + 1}`;
          html += `<h4>${subNum} ${escapeHtml(sp.titre)}</h4>`;
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
  const romains = brouillon.niveau_detail === 'tres_detaille';
  const introHtml =
    paragraphsHtml(brouillon.introduction) +
    `<p><em>${escapeHtml(niveauLibelle)}</em></p>`;
  const pointsHtml = pointsOrdreJourVersHtml(brouillon.points_ordre_jour, {
    chiffresRomains: romains,
  });
  const conclusionHtml = paragraphsHtml(brouillon.conclusion);

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

function compterMots(texte: string): number {
  return texte
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function maxTokensPourNiveau(niveau: NiveauDetailCr): number {
  switch (niveau) {
    case 'simple':
      return 14000;
    case 'tres_detaille':
      // Sortie max réaliste selon modèles ; génération multi-passes ailleurs si besoin
      return 16000;
    default:
      return 16000;
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

  private async appelerJson(
    system: string,
    user: string,
    opts?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    this.assurerConfigure();
    const model = env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? 8000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
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
    return contenu;
  }

  async genererBrouillon(
    reunion: ContexteReunionIa,
    transcription: string,
    niveau: NiveauDetailCr = 'detaille',
  ): Promise<BrouillonCrIa> {
    const texte = transcription.trim();
    if (texte.length < 40) {
      throw new AppError(
        400,
        'Transcription trop courte pour générer un compte rendu. Sauvegardez d’abord le texte STT.',
      );
    }

    const contenu = await this.appelerJson(
      construirePromptSysteme(),
      construirePromptUtilisateur(reunion, texte, niveau),
      {
        temperature: niveau === 'tres_detaille' ? 0.28 : 0.32,
        maxTokens: maxTokensPourNiveau(niveau),
      },
    );

    try {
      return parserBrouillonCrIa(contenu, niveau);
    } catch (err) {
      logger.error({ err, contenu: contenu.slice(0, 400) }, 'JSON CR IA invalide');
      throw new AppError(502, 'Le modèle a renvoyé un JSON invalide.');
    }
  }

  /**
   * Génère UN grand point exhaustif (≥150 mots / sous-point) à partir de la transcription.
   */
  async genererGrandPointExhaustif(opts: {
    reunionTitre: string;
    titrePoint: string;
    indexRomain: string;
    transcription: string;
    contexteGlobal: string;
  }): Promise<PointOrdreJourIa> {
    const system = `Tu es rédacteur officiel de comptes rendus administratifs OGEFREM (RDC).
Tu rédiges UNIQUEMENT le grand point « ${opts.titrePoint} » (chiffre romain ${opts.indexRomain}).
Français administratif dense. Réponds UNIQUEMENT en JSON valide.
Ne invente aucun fait hors transcription ; développe largement ce qui y figure.`;

    const user = `Réunion : ${opts.reunionTitre}
Contexte : ${opts.contexteGlobal}

Grand point à rédiger : ${opts.indexRomain}. ${opts.titrePoint}

EXIGENCES DE VOLUME (obligatoires) :
- "contenu" (introduction du point) : MINIMUM 120 mots, idéalement 150–220.
- Chaque "sous_points[].contenu" : MINIMUM 150 mots, idéalement 180–250.
- Au moins 3 sous-points (4 à 6 si la transcription le permet).
- Paragraphes développés : ce qui a été présenté, dit, demandé, répondu, décidé.

=== TRANSCRIPTION ===
${opts.transcription.trim()}

=== JSON ===
{
  "titre": "${opts.titrePoint}",
  "contenu": "...",
  "sous_points": [
    { "titre": "...", "contenu": "..." }
  ]
}`;

    const brut = await this.appelerJson(system, user, {
      temperature: 0.35,
      maxTokens: 10000,
    });

    let parsed: unknown;
    try {
      let t = brut.trim();
      if (t.startsWith('```')) {
        const parts = t.split('```');
        t = parts[1] ?? t;
        if (t.startsWith('json')) t = t.slice(4);
      }
      parsed = JSON.parse(t.trim());
    } catch {
      throw new AppError(502, `JSON invalide pour le point « ${opts.titrePoint} ».`);
    }

    const point = normaliserPoint(parsed);
    if (!point) {
      throw new AppError(502, `Point « ${opts.titrePoint} » vide.`);
    }
    point.titre = opts.titrePoint;

    // 2e passe : enrichir les sous-points trop courts
    const enrichis: SousPointIa[] = [];
    for (const sp of point.sous_points) {
      if (compterMots(sp.contenu) >= 150) {
        enrichis.push(sp);
        continue;
      }
      try {
        const etendu = await this.enrichirSousPoint({
          titrePoint: opts.titrePoint,
          titreSousPoint: sp.titre,
          contenuActuel: sp.contenu,
          transcription: opts.transcription,
        });
        enrichis.push(etendu);
      } catch {
        enrichis.push(sp);
      }
    }
    point.sous_points = enrichis.length > 0 ? enrichis : point.sous_points;

    if (compterMots(point.contenu) < 100) {
      try {
        const etenduIntro = await this.enrichirSousPoint({
          titrePoint: opts.titrePoint,
          titreSousPoint: `Introduction — ${opts.titrePoint}`,
          contenuActuel: point.contenu,
          transcription: opts.transcription,
        });
        point.contenu = etenduIntro.contenu;
      } catch {
        /* keep */
      }
    }

    return point;
  }

  async enrichirSousPoint(opts: {
    titrePoint: string;
    titreSousPoint: string;
    contenuActuel: string;
    transcription: string;
  }): Promise<SousPointIa> {
    const system = `Tu enrichis un sous-point de compte rendu OGEFREM. JSON uniquement.
Le champ "contenu" DOIT contenir AU MOINS 150 mots (viser 200).`;
    const user = `Point parent : ${opts.titrePoint}
Sous-point : ${opts.titreSousPoint}
Texte actuel (à développer, pas à résumer) :
${opts.contenuActuel || '(vide)'}

=== TRANSCRIPTION (source) ===
${opts.transcription.trim().slice(0, 24000)}

JSON attendu :
{ "titre": "${opts.titreSousPoint}", "contenu": "texte développé ≥ 150 mots" }`;

    const brut = await this.appelerJson(system, user, {
      temperature: 0.4,
      maxTokens: 4000,
    });
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(brut.trim()) as Record<string, unknown>;
    } catch {
      return {
        titre: opts.titreSousPoint,
        contenu: opts.contenuActuel,
      };
    }
    const sp = normaliserSousPoint(parsed);
    return (
      sp ?? {
        titre: opts.titreSousPoint,
        contenu: opts.contenuActuel,
      }
    );
  }

  async genererIntroductionConclusion(opts: {
    reunion: ContexteReunionIa;
    transcription: string;
    pointsTitres: string[];
  }): Promise<{ introduction: string; conclusion: string }> {
    const system = `Rédacteur CR OGEFREM. JSON uniquement. Textes longs et administratifs.`;
    const user = `Réunion : ${opts.reunion.titre}
Description : ${opts.reunion.description ?? ''}
Points du rapport : ${opts.pointsTitres.join(' | ')}

Écris :
- introduction : MINIMUM 150 mots (contexte, parties, objet de la séance) — sans recopier titre/date/lieu.
- conclusion : MINIMUM 200 mots (bilan, décisions, actions, échéances, suites).

=== TRANSCRIPTION ===
${opts.transcription.trim().slice(0, 28000)}

JSON : { "introduction": "...", "conclusion": "..." }`;

    const brut = await this.appelerJson(system, user, {
      temperature: 0.3,
      maxTokens: 6000,
    });
    try {
      const parsed = JSON.parse(brut.trim()) as Record<string, unknown>;
      return {
        introduction: String(parsed.introduction ?? '').trim(),
        conclusion: String(parsed.conclusion ?? '').trim(),
      };
    } catch {
      return { introduction: '', conclusion: '' };
    }
  }
}

export const crIaService = new CrIaService();
export { compterMots };