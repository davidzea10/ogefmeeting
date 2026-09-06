/**
 * Lexique métier OGEFREM pour le « boosting » STT Deepgram
 * (keyterm sur Nova-3, keywords sur Nova-2).
 *
 * Objectif : forcer la reconnaissance des sigles / abréviations / noms propres
 * rarement présents dans le modèle général français.
 *
 * Limite pratique Deepgram : rester sous ~100 termes pour de bons résultats.
 * Ajouter des termes via DEEPGRAM_KEYTERMS (séparés par des virgules) sans redeploy code.
 */

/** Sigles directions siège */
const DIRECTIONS_SIEGE = [
  'OGEFREM',
  'DG',
  'DGA',
  'DGIT',
  'DANTIC',
  'DFM',
  'DTFM',
  'DFAC',
  'DEP',
  'DSG',
  'DOCG',
  'DRH',
  'DFIN',
  'DAI',
  'DAJ',
  'DII',
  'DSAERM',
  'DRCP',
] as const;

/** Directions provinciales / régionales */
const DIRECTIONS_PROVINCIALES = [
  'DPKIN',
  'DPO',
  'DRGB',
  'DRGE',
  'DRGK',
  'DRIHU',
  'DPMA',
  'DPNK',
  'DPSK',
  'DRNK',
  'DRSK',
  'DRTBU',
] as const;

/** Instruments de traçabilité et jargon métier */
const INSTRUMENTS_ET_METIER = [
  'FERI',
  'FERE',
  'AD',
  'NTIC',
  'BSC',
  'Ogefmeeting',
  'chargeur',
  'chargeurs',
  'mandataire',
  'mandataires',
  'traçabilité',
  'fret multimodal',
  'fret maritime',
  'sous-directeur',
  'chef de service',
  'ordre du jour',
  'compte rendu',
] as const;

/** Noms / libellés longs utiles (phrases = un seul keyterm) */
const LIBELLES_LONGS = [
  'Office de Gestion du Fret Multimodal',
  "Direction de l'Application des NTIC",
  'Direction de Gestion des Instruments de Traçabilité',
  'Direction Provinciale de Kinshasa',
] as const;

/**
 * Liste unique des termes à booster (ordre stable).
 * Les doublons et chaînes vides sont retirés.
 */
export const LEXIQUE_STT_OGEFREM: string[] = [
  ...DIRECTIONS_SIEGE,
  ...DIRECTIONS_PROVINCIALES,
  ...INSTRUMENTS_ET_METIER,
  ...LIBELLES_LONGS,
].filter((t, i, arr) => {
  const n = t.trim();
  return n.length > 0 && arr.findIndex((x) => x.trim() === n) === i;
});

/** Intensité keywords (Nova-2 uniquement). Plage typique : 1 à 5. */
export const KEYWORD_INTENSIFIER_NOVA2 = 2;
