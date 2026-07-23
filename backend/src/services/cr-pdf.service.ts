import PDFDocument from 'pdfkit';
import type { CompteRendu, Reunion, SectionCompteRendu } from '@ogefmeeting/shared';

const SECTIONS_DEFAUT: SectionCompteRendu[] = [
  { cle: 'contexte', libelle: 'Contexte et objectifs' },
  { cle: 'participants', libelle: 'Participants' },
  { cle: 'ordre_du_jour', libelle: 'Points abordés' },
  { cle: 'decisions', libelle: 'Décisions prises' },
  { cle: 'actions', libelle: 'Actions à mener' },
  { cle: 'prochaine_reunion', libelle: 'Prochaine réunion' },
];

const LIBELLES_STATUT: Record<string, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  en_revision: 'En révision',
  valide: 'Validé',
  archive: 'Archivé',
};

export type PdfCompteRenduInput = {
  compteRendu: CompteRendu;
  reunion: Pick<Reunion, 'titre' | 'date_prevue' | 'lieu' | 'type_reunion' | 'description'>;
  sections?: SectionCompteRendu[] | null;
  valideParNom?: string | null;
  enTetePdf?: string | null;
  sousTitrePdf?: string | null;
};

/** Convertit un fragment HTML TipTap en texte lisible pour PDF. */
export function htmlVersTexte(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(ul|ol)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase();
}

export function nomFichierPdfCr(reunionTitre: string, version: number): string {
  const base = slugify(reunionTitre) || 'compte-rendu';
  return `cr-${base}-v${version}.pdf`;
}

/**
 * Génère un PDF A4 OGEFREM à partir du compte rendu.
 */
export async function genererPdfCompteRendu(input: PdfCompteRenduInput): Promise<Buffer> {
  const { compteRendu, reunion, valideParNom } = input;
  const sections =
    input.sections && input.sections.length > 0 ? input.sections : SECTIONS_DEFAUT;
  const enTete = input.enTetePdf?.trim() || 'OGEFREM';
  const sousTitre =
    input.sousTitrePdf?.trim() ||
    'Office de Gestion du Fret Multimodal — Ogefmeeting';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: `Compte rendu — ${reunion.titre}`,
        Author: 'Ogefmeeting / OGEFREM',
        Subject: 'Compte rendu de réunion',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // En-tête (paramètres application)
    doc
      .fillColor('#003366')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(enTete, { align: 'left' });
    doc
      .fillColor('#666666')
      .fontSize(9)
      .font('Helvetica')
      .text(sousTitre, { align: 'left' });

    doc.moveDown(0.6);
    doc
      .strokeColor('#F5C518')
      .lineWidth(2)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .stroke();

    doc.moveDown(1);
    doc
      .fillColor('#111111')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Compte rendu de réunion', { align: 'left' });

    doc.moveDown(0.4);
    doc
      .fillColor('#003366')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(reunion.titre, { align: 'left' });

    doc.moveDown(0.6);
    doc.fillColor('#333333').fontSize(10).font('Helvetica');
    doc.text(`Date : ${formatDateFr(reunion.date_prevue)}`);
    if (reunion.lieu) doc.text(`Lieu : ${reunion.lieu}`);
    doc.text(`Statut : ${LIBELLES_STATUT[compteRendu.statut] ?? compteRendu.statut}`);
    doc.text(`Version : ${compteRendu.version}`);
    if (compteRendu.soumis_le) {
      doc.text(`Soumis le : ${formatDateFr(compteRendu.soumis_le)}`);
    }
    if (compteRendu.valide_le) {
      doc.text(
        `Validé le : ${formatDateFr(compteRendu.valide_le)}${
          valideParNom ? ` par ${valideParNom}` : ''
        }`,
      );
    }

    doc.moveDown(0.8);

    // Sections
    for (const section of sections) {
      const raw = compteRendu.contenu?.[section.cle];
      const html =
        typeof raw === 'string'
          ? raw
          : compteRendu.contenu_html && sections.length === 1
            ? compteRendu.contenu_html
            : '';
      const texte = htmlVersTexte(html) || '—';

      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }

      doc
        .fillColor('#003366')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(section.libelle, { underline: false });

      doc.moveDown(0.25);
      doc
        .fillColor('#222222')
        .fontSize(10)
        .font('Helvetica')
        .text(texte, {
          align: 'left',
          lineGap: 2,
        });
      doc.moveDown(0.7);
    }

    // Pied de page sur chaque page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 36;
      doc
        .fontSize(8)
        .fillColor('#888888')
        .font('Helvetica')
        .text(
          `Ogefmeeting — Document généré le ${formatDateFr(new Date().toISOString())} — page ${i - range.start + 1}/${range.count}`,
          doc.page.margins.left,
          bottom,
          { width: pageWidth, align: 'center' },
        );
    }

    doc.end();
  });
}
