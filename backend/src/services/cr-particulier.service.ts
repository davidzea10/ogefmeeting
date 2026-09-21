import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  brouillonVersContenuSections,
  compterMots,
  crIaService,
  type BrouillonCrIa,
  type ContexteReunionIa,
  type PointOrdreJourIa,
} from './cr-ia.service.js';
import {
  genererPdfCompteRendu,
  type PdfParticipantLigne,
} from './cr-pdf.service.js';
import type { CompteRendu } from '@ogefmeeting/shared';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROMAINS = [
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
] as const;

/** Métadonnées figées — réunion DANTIC / PADS sur l’infrastructure SYGREM. */
export const CR_PARTICULIER_PADS_META = {
  id: 'pads-sygren-infra',
  titre:
    'Réunion avec PADS sur l’infrastructure applicative de l’application SYGREM',
  type_reunion: 'partenaire' as const,
  lieu: 'Salle / visioconférence DANTIC — OGEFREM',
  date_reunion: '2026',
  directions_codes: ['DANTIC'],
  description:
    'Séance de travail entre l’OGEFREM (représenté par la DANTIC) et le partenaire PADS, ' +
    'chargé du développement / de l’infrastructure de l’application SYGREM. ' +
    'PADS devait présenter l’architecture applicative et serveur, les mécanismes de haute ' +
    'disponibilité et de sécurité, et répondre aux questions techniques de la DANTIC.',
  participants: [
    'DANTIC — OGEFREM (équipe technique / direction)',
    'PADS — partenaires techniques (présentation architecture, serveurs, sécurité)',
    'Christian (PADS) — présentation architecture / schéma',
    'Monsieur Délord / Delorme (échanges techniques sécurité)',
    'Représentants DGA / cadrage de séance',
  ],
  points_ordre_jour: [
    'Objectifs de la réunion',
    'Présentation de l’architecture infrastructure et applicative SYGREM',
    'Haute disponibilité, réplication et équilibrage de charge',
    'Configuration des serveurs (front, back, bases de données)',
    'Mécanismes de sécurité, firewall, VPN et alertes',
    'Questions techniques DANTIC et échanges avec PADS',
    'Dispositions retenues, documentation à partager et prochaines séances',
  ],
};

function chargerTranscriptionFixture(): string {
  const candidats = [
    join(__dirname, '..', 'fixtures', 'pads-sygren-stt.txt'),
    join(process.cwd(), 'src', 'fixtures', 'pads-sygren-stt.txt'),
    join(process.cwd(), 'backend', 'src', 'fixtures', 'pads-sygren-stt.txt'),
    join(process.cwd(), 'dist', 'fixtures', 'pads-sygren-stt.txt'),
  ];
  for (const chemin of candidats) {
    try {
      return readFileSync(chemin, 'utf8');
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Fixture STT PADS/SYGREM introuvable (backend/src/fixtures/pads-sygren-stt.txt).',
  );
}

export type CrParticulierStats = {
  mots_introduction: number;
  mots_conclusion: number;
  mots_total: number;
  points: Array<{
    titre: string;
    romain: string;
    mots_contenu: number;
    sous_points: Array<{ titre: string; mots: number }>;
  }>;
};

export type CrParticulierPreview = {
  meta: typeof CR_PARTICULIER_PADS_META;
  brouillon: BrouillonCrIa;
  contenu: Record<string, string>;
  contenu_html: string;
  nb_mots_transcription: number;
  stats: CrParticulierStats;
};

function calculerStats(brouillon: BrouillonCrIa): CrParticulierStats {
  const points = brouillon.points_ordre_jour.map((p, i) => ({
    titre: p.titre,
    romain: ROMAINS[i] ?? String(i + 1),
    mots_contenu: compterMots(p.contenu),
    sous_points: p.sous_points.map((sp) => ({
      titre: sp.titre,
      mots: compterMots(sp.contenu),
    })),
  }));
  const motsPoints = points.reduce(
    (acc, p) =>
      acc +
      p.mots_contenu +
      p.sous_points.reduce((a, sp) => a + sp.mots, 0),
    0,
  );
  const mots_introduction = compterMots(brouillon.introduction);
  const mots_conclusion = compterMots(brouillon.conclusion);
  return {
    mots_introduction,
    mots_conclusion,
    mots_total: mots_introduction + mots_conclusion + motsPoints,
    points,
  };
}

/**
 * HTML d’aperçu aligné sur le CR normal :
 * Introduction → I. / II. / … (grands points) → Conclusion
 */
function contenuVersHtmlComplet(contenu: Record<string, string>): string {
  const intro = contenu.contexte ?? '<p></p>';
  const points = contenu.ordre_du_jour ?? '<p></p>';
  const conclusion = contenu.conclusion ?? '<p></p>';
  return [
    `<h2>Introduction</h2>`,
    intro,
    `<h2>Points de l’ordre du jour</h2>`,
    points,
    `<h2>Conclusion</h2>`,
    conclusion,
  ].join('\n');
}

export class CrParticulierService {
  obtenirMeta() {
    const texte = chargerTranscriptionFixture();
    return {
      ...CR_PARTICULIER_PADS_META,
      transcription_apercu: texte.slice(0, 1200),
      nb_mots_transcription: texte.trim().split(/\s+/).length,
      transcription_complete: true,
    };
  }

  /**
   * Génération multi-passes : un appel GPT par grand point (I…VII),
   * puis intro/conclusion, avec enrichissement des sous-points &lt; 150 mots.
   */
  async genererTresDetaille(): Promise<CrParticulierPreview> {
    const transcription = chargerTranscriptionFixture();
    const contexte: ContexteReunionIa = {
      titre: CR_PARTICULIER_PADS_META.titre,
      type_reunion: CR_PARTICULIER_PADS_META.type_reunion,
      lieu: CR_PARTICULIER_PADS_META.lieu,
      date_reunion: CR_PARTICULIER_PADS_META.date_reunion,
      directions_codes: CR_PARTICULIER_PADS_META.directions_codes,
      description: CR_PARTICULIER_PADS_META.description,
      participants: CR_PARTICULIER_PADS_META.participants,
      points_ordre_jour: CR_PARTICULIER_PADS_META.points_ordre_jour,
    };

    const contexteGlobal = [
      CR_PARTICULIER_PADS_META.description,
      `Participants : ${CR_PARTICULIER_PADS_META.participants.join(' ; ')}`,
      `Plan du rapport (chiffres romains) : ${CR_PARTICULIER_PADS_META.points_ordre_jour
        .map((t, i) => `${ROMAINS[i]}. ${t}`)
        .join(' | ')}`,
    ].join('\n');

    const points: PointOrdreJourIa[] = [];
    const titres = CR_PARTICULIER_PADS_META.points_ordre_jour;

    for (let i = 0; i < titres.length; i++) {
      const titrePoint = titres[i];
      const indexRomain = ROMAINS[i] ?? String(i + 1);
      logger.info(
        { indexRomain, titrePoint, etape: `${i + 1}/${titres.length}` },
        'CR particulier — génération grand point',
      );

      const point = await crIaService.genererGrandPointExhaustif({
        reunionTitre: CR_PARTICULIER_PADS_META.titre,
        titrePoint,
        indexRomain,
        transcription,
        contexteGlobal,
      });

      if (i === 0) {
        point.titre = 'Objectifs de la réunion';
      }
      points.push(point);
    }

    logger.info('CR particulier — introduction / conclusion');
    let { introduction, conclusion } =
      await crIaService.genererIntroductionConclusion({
        reunion: contexte,
        transcription,
        pointsTitres: points.map((p) => p.titre),
      });

    if (compterMots(introduction) < 150) {
      try {
        const etendu = await crIaService.enrichirSousPoint({
          titrePoint: 'Introduction',
          titreSousPoint: 'Introduction générale',
          contenuActuel: introduction || CR_PARTICULIER_PADS_META.description,
          transcription,
        });
        introduction = etendu.contenu;
      } catch {
        /* keep */
      }
    }
    if (compterMots(conclusion) < 200) {
      try {
        const etendu = await crIaService.enrichirSousPoint({
          titrePoint: 'Conclusion',
          titreSousPoint: 'Conclusion et dispositions retenues',
          contenuActuel: conclusion || 'Dispositions retenues à la suite de la séance.',
          transcription,
        });
        conclusion = etendu.contenu;
      } catch {
        /* keep */
      }
    }

    const brouillon: BrouillonCrIa = {
      niveau_detail: 'tres_detaille',
      directions_impliquees: [...CR_PARTICULIER_PADS_META.directions_codes],
      introduction,
      points_ordre_jour: points,
      conclusion,
    };

    const sections = ['contexte', 'ordre_du_jour', 'conclusion'];
    const contenu = brouillonVersContenuSections(brouillon, sections);
    const contenu_html = contenuVersHtmlComplet(contenu);
    const stats = calculerStats(brouillon);

    logger.info(
      {
        mots_total: stats.mots_total,
        points: stats.points.map((p) => ({
          romain: p.romain,
          titre: p.titre,
          sous: p.sous_points.map((s) => s.mots),
        })),
      },
      'CR particulier — génération terminée',
    );

    return {
      meta: CR_PARTICULIER_PADS_META,
      brouillon,
      contenu,
      contenu_html,
      nb_mots_transcription: transcription.trim().split(/\s+/).length,
      stats,
    };
  }

  async genererPdfDepuisBrouillon(preview: {
    contenu_html: string;
    contenu: Record<string, string>;
  }): Promise<Buffer> {
    const compteRendu = {
      id: 'cr-particulier-pads',
      reunion_id: 'reunion-pads-sygren',
      statut: 'brouillon',
      contenu: preview.contenu,
      contenu_html: preview.contenu_html,
      version: 1,
      soumis_le: null,
      valide_le: null,
      valide_par: null,
      chemin_pdf: null,
      cree_par: null,
      cree_le: new Date().toISOString(),
      modifie_le: new Date().toISOString(),
      afficher_participants_corps: true,
    } as CompteRendu;

    const participants: PdfParticipantLigne[] = [
      {
        nom: 'Équipe DANTIC — OGEFREM',
        fonction: 'Direction / technique',
        email: null,
        direction: 'DANTIC',
      },
      {
        nom: 'Équipe PADS',
        fonction: 'Partenaire technique SYGREM',
        email: null,
        direction: null,
        externe: true,
      },
    ];

    return genererPdfCompteRendu({
      compteRendu,
      reunion: {
        titre: CR_PARTICULIER_PADS_META.titre,
        date_prevue: new Date().toISOString(),
        date_debut: null,
        date_fin: null,
        lieu: CR_PARTICULIER_PADS_META.lieu,
        type_reunion: CR_PARTICULIER_PADS_META.type_reunion,
        description: CR_PARTICULIER_PADS_META.description,
      },
      sections: [
        { cle: 'contexte', libelle: 'Introduction' },
        { cle: 'participants', libelle: 'Participants' },
        { cle: 'ordre_du_jour', libelle: 'Points de l’ordre du jour' },
        { cle: 'conclusion', libelle: 'Conclusion' },
      ],
      participants,
    });
  }
}

export const crParticulierService = new CrParticulierService();
