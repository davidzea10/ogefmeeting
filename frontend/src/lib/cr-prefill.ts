import type {
  Direction,
  ModeleCompteRendu,
  Profil,
  ReunionDetail,
  SectionCompteRendu,
} from '@ogefmeeting/shared';
import { LIBELLES_PARTICIPANT } from '@/lib/labels';

/**
 * Sections par défaut — pas de sections globales Décisions / Actions :
 * elles vivent dans chaque point d'ordre du jour (génération IA).
 */
export const SECTIONS_CR_DEFAUT: SectionCompteRendu[] = [
  { cle: 'contexte', libelle: 'Introduction' },
  { cle: 'participants', libelle: 'Participants' },
  { cle: 'ordre_du_jour', libelle: 'Points de l’ordre du jour' },
  { cle: 'conclusion', libelle: 'Conclusion' },
];

export type ContenuCr = Record<string, string>;

const AVERTISSEMENT_IA_SUPPRIME =
  'Brouillon généré par IA — à valider par le secrétariat avant publication';

/** Retire l’avertissement IA legacy des sections CR déjà générées. */
export function nettoyerContenuCr(contenu: ContenuCr): ContenuCr {
  const out: ContenuCr = {};
  for (const [cle, html] of Object.entries(contenu)) {
    let h = html;
    if (h.includes(AVERTISSEMENT_IA_SUPPRIME)) {
      h = h
        .replace(
          new RegExp(
            `<p>\\s*${AVERTISSEMENT_IA_SUPPRIME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`,
            'gi',
          ),
          '',
        )
        .replace(AVERTISSEMENT_IA_SUPPRIME, '');
    }
    out[cle] = h;
  }
  return out;
}

export type LigneParticipantCr = {
  nom: string;
  matricule: string;
  email: string;
  direction: string;
  statut: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphs(lines: string[]): string {
  const cleaned = lines.filter((l) => l.trim().length > 0);
  if (cleaned.length === 0) return '<p></p>';
  return cleaned.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function listHtml(items: string[]): string {
  if (items.length === 0) return '<p><em>Aucun élément.</em></p>';
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function directionAbregee(
  directionId: string | null | undefined,
  directions: Map<string, Direction>,
): string {
  if (!directionId) return '—';
  const dir = directions.get(directionId);
  if (!dir) return '—';
  if (dir.code?.trim()) return dir.code.trim().toUpperCase();
  return dir.nom.trim().toUpperCase();
}

/** Construit les lignes du tableau participants (Noms, matricule, mail, direction, statut). */
export function construireLignesParticipantsCr(
  reunion: ReunionDetail,
  profils: Profil[],
  directions: Direction[],
): LigneParticipantCr[] {
  const profilMap = new Map(profils.map((p) => [p.id, p]));
  const directionMap = new Map(directions.map((d) => [d.id, d]));

  return reunion.participants.map((p) => {
    const profil = profilMap.get(p.profil_id);
    const nom = profil ? `${profil.prenom} ${profil.nom}`.trim() : p.profil_id.slice(0, 8);
    return {
      nom: nom || '—',
      matricule: profil?.matricule?.trim() || '—',
      email: profil?.email?.trim() || '—',
      direction: directionAbregee(profil?.direction_id, directionMap),
      statut: LIBELLES_PARTICIPANT[p.statut] ?? p.statut,
    };
  });
}

/** HTML table pour la section participants du CR. */
export function participantsTableHtml(lignes: LigneParticipantCr[]): string {
  if (lignes.length === 0) {
    return '<p><em>Aucun participant.</em></p>';
  }

  const header =
    '<thead><tr>' +
    '<th>Nom</th><th>Matricule</th><th>Email</th><th>Direction</th><th>Statut</th>' +
    '</tr></thead>';

  const body = lignes
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.nom)}</td><td>${escapeHtml(l.matricule)}</td>` +
        `<td>${escapeHtml(l.email)}</td><td>${escapeHtml(l.direction)}</td>` +
        `<td>${escapeHtml(l.statut)}</td></tr>`,
    )
    .join('');

  return `<table>${header}<tbody>${body}</tbody></table>`;
}

/**
 * Construit un contenu HTML prérempli à partir de la réunion + sections du modèle.
 */
export function preremplirContenuCr(
  reunion: ReunionDetail,
  sections: SectionCompteRendu[],
  profils: Profil[],
  directions: Direction[] = [],
): ContenuCr {
  const lignesParticipants = construireLignesParticipantsCr(reunion, profils, directions);

  const points = [...reunion.points_ordre_jour]
    .sort((a, b) => a.ordre - b.ordre)
    .map((p) => `${p.est_traite ? '✓' : '○'} ${p.titre}${p.description ? ` — ${p.description}` : ''}`);

  const prefillByCle: ContenuCr = {
    contexte: paragraphs([
      reunion.description?.trim()
        ? reunion.description.trim()
        : 'Présentation des objectifs et du déroulement de la séance (titre, date et lieu figurent en en-tête du document).',
    ]),
    participants: participantsTableHtml(lignesParticipants),
    ordre_du_jour: listHtml(points),
    points_techniques: listHtml(points),
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
    if (section.cle === 'decisions' || section.cle === 'actions') continue;
    contenu[section.cle] = prefillByCle[section.cle] ?? '<p></p>';
  }
  return contenu;
}

export function sectionsDepuisModele(
  modele: ModeleCompteRendu | null | undefined,
): SectionCompteRendu[] {
  const raw = modele?.sections?.length ? modele.sections : SECTIONS_CR_DEFAUT;
  return raw.filter((s) => s.cle !== 'decisions' && s.cle !== 'actions');
}

export function contenuEstVide(contenu: Record<string, unknown> | null | undefined): boolean {
  if (!contenu || Object.keys(contenu).length === 0) return true;
  return Object.values(contenu).every((v) => {
    if (typeof v !== 'string') return false;
    const text = v.replace(/<[^>]+>/g, '').trim();
    return text.length === 0;
  });
}

export function contenuVersHtml(
  sections: SectionCompteRendu[],
  contenu: ContenuCr,
  options?: { inclureParticipants?: boolean },
): string {
  const inclureParticipants = options?.inclureParticipants !== false;
  const sectionsFiltrees = inclureParticipants
    ? sections
    : sections.filter((s) => s.cle !== 'participants');

  return sectionsFiltrees
    .map((s) => `<h2>${escapeHtml(s.libelle)}</h2>${contenu[s.cle] ?? '<p></p>'}`)
    .join('\n');
}
