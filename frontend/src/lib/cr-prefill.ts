import type { ModeleCompteRendu, ReunionDetail, SectionCompteRendu } from '@ogefmeeting/shared';
import { formatDateHeure, LIBELLES_PARTICIPANT, LIBELLES_TYPE } from '@/lib/labels';

/** Sections par défaut si aucun modèle n’est associé à la réunion */
export const SECTIONS_CR_DEFAUT: SectionCompteRendu[] = [
  { cle: 'contexte', libelle: 'Contexte et objectifs' },
  { cle: 'participants', libelle: 'Participants' },
  { cle: 'ordre_du_jour', libelle: 'Points abordés' },
  { cle: 'decisions', libelle: 'Décisions prises' },
  { cle: 'actions', libelle: 'Actions à mener' },
  { cle: 'prochaine_reunion', libelle: 'Prochaine réunion' },
];

export type ContenuCr = Record<string, string>;

function paragraphs(lines: string[]): string {
  const cleaned = lines.filter((l) => l.trim().length > 0);
  if (cleaned.length === 0) return '<p></p>';
  return cleaned.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listHtml(items: string[]): string {
  if (items.length === 0) return '<p><em>Aucun élément.</em></p>';
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

/**
 * Construit un contenu HTML prérempli à partir de la réunion + sections du modèle.
 */
export function preremplirContenuCr(
  reunion: ReunionDetail,
  sections: SectionCompteRendu[],
  profilNoms: Map<string, string>,
): ContenuCr {
  const presents = reunion.participants
    .filter((p) => p.statut === 'present' || p.statut === 'confirme')
    .map((p) => {
      const nom = profilNoms.get(p.profil_id) ?? p.profil_id.slice(0, 8);
      return `${nom} (${LIBELLES_PARTICIPANT[p.statut] ?? p.statut})`;
    });

  const absents = reunion.participants
    .filter((p) => p.statut === 'absent')
    .map((p) => profilNoms.get(p.profil_id) ?? p.profil_id.slice(0, 8));

  const points = [...reunion.points_ordre_jour]
    .sort((a, b) => a.ordre - b.ordre)
    .map((p) => `${p.est_traite ? '✓' : '○'} ${p.titre}${p.description ? ` — ${p.description}` : ''}`);

  const prefillByCle: ContenuCr = {
    contexte: paragraphs([
      `Réunion : ${reunion.titre}`,
      `Type : ${LIBELLES_TYPE[reunion.type_reunion]}`,
      `Date prévue : ${formatDateHeure(reunion.date_prevue)}`,
      reunion.lieu ? `Lieu : ${reunion.lieu}` : '',
      reunion.description ? `Description : ${reunion.description}` : '',
    ]),
    participants: [
      '<p><strong>Présents / confirmés</strong></p>',
      listHtml(presents),
      '<p><strong>Absents</strong></p>',
      listHtml(absents),
    ].join(''),
    ordre_du_jour: listHtml(points),
    points_techniques: listHtml(points),
    decisions: '<p></p>',
    actions: '<p></p>',
    prochaine_reunion: '<p></p>',
    synthese: paragraphs([reunion.description || reunion.titre]),
    operations: '<p></p>',
    blocages: '<p></p>',
    echanges: '<p></p>',
    accords: '<p></p>',
    suivi: '<p></p>',
    risques: '<p></p>',
  };

  const contenu: ContenuCr = {};
  for (const section of sections) {
    contenu[section.cle] = prefillByCle[section.cle] ?? '<p></p>';
  }
  return contenu;
}

export function sectionsDepuisModele(
  modele: ModeleCompteRendu | null | undefined,
): SectionCompteRendu[] {
  if (modele?.sections?.length) return modele.sections;
  return SECTIONS_CR_DEFAUT;
}

export function contenuEstVide(contenu: Record<string, unknown> | null | undefined): boolean {
  if (!contenu || Object.keys(contenu).length === 0) return true;
  return Object.values(contenu).every((v) => {
    if (typeof v !== 'string') return false;
    const text = v.replace(/<[^>]+>/g, '').trim();
    return text.length === 0;
  });
}

export function contenuVersHtml(sections: SectionCompteRendu[], contenu: ContenuCr): string {
  return sections
    .map((s) => `<h2>${escapeHtml(s.libelle)}</h2>${contenu[s.cle] ?? '<p></p>'}`)
    .join('\n');
}
