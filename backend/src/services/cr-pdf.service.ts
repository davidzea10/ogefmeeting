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

const LIBELLES_TYPE: Record<string, string> = {
  conseil_direction: 'Conseil de direction',
  technique: 'Technique',
  operationnel: 'Opérationnel',
  partenaire: 'Partenaires',
  autre: 'Autre',
};

const LIBELLES_PARTICIPANT: Record<string, string> = {
  invite: 'Invité',
  confirme: 'Confirmé',
  present: 'Présent',
  absent: 'Absent',
};

const COLORS = {
  navy: '#003366',
  blue: '#0B4F8A',
  gold: '#D4A017',
  ink: '#1A1A1A',
  muted: '#5C6B7A',
  line: '#D8DEE6',
  soft: '#F4F7FA',
  white: '#FFFFFF',
};

export type PdfParticipantLigne = {
  nom: string;
  email?: string | null;
  direction?: string | null;
  fonction?: string | null;
  statut: string;
};

export type PdfCompteRenduInput = {
  compteRendu: CompteRendu;
  reunion: Pick<Reunion, 'titre' | 'date_prevue' | 'lieu' | 'type_reunion' | 'description'>;
  sections?: SectionCompteRendu[] | null;
  participants?: PdfParticipantLigne[] | null;
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

function formatDateCourteFr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
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

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, pageWidth: number) {
  ensureSpace(doc, 48);
  const y = doc.y;
  doc
    .save()
    .rect(doc.page.margins.left, y, 4, 18)
    .fill(COLORS.gold);
  doc.restore();

  doc
    .fillColor(COLORS.navy)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(title, doc.page.margins.left + 12, y + 2, { width: pageWidth - 12 });

  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, doc.y + 6)
    .lineTo(doc.page.margins.left + pageWidth, doc.y + 6)
    .stroke();

  doc.moveDown(0.85);
}

function drawParticipantsTable(
  doc: PDFKit.PDFDocument,
  participants: PdfParticipantLigne[],
  pageWidth: number,
) {
  const left = doc.page.margins.left;
  const col = {
    nom: Math.floor(pageWidth * 0.28),
    email: Math.floor(pageWidth * 0.28),
    direction: Math.floor(pageWidth * 0.22),
    statut: Math.floor(pageWidth * 0.22),
  };
  const rowH = 22;
  const headerH = 24;

  const drawHeader = () => {
    ensureSpace(doc, headerH + 8);
    const y = doc.y;
    doc.save().rect(left, y, pageWidth, headerH).fill(COLORS.navy).restore();
    doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold');
    let x = left + 8;
    doc.text('Nom', x, y + 8, { width: col.nom - 12 });
    x += col.nom;
    doc.text('Email', x, y + 8, { width: col.email - 12 });
    x += col.email;
    doc.text('Direction', x, y + 8, { width: col.direction - 12 });
    x += col.direction;
    doc.text('Statut', x, y + 8, { width: col.statut - 12 });
    doc.y = y + headerH;
  };

  drawHeader();

  participants.forEach((p, index) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - rowH - 8) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    if (index % 2 === 0) {
      doc.save().rect(left, y, pageWidth, rowH).fill(COLORS.soft).restore();
    }
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(left, y + rowH)
      .lineTo(left + pageWidth, y + rowH)
      .stroke();

    doc.fillColor(COLORS.ink).fontSize(8).font('Helvetica');
    let x = left + 8;
    doc.text(p.nom || '—', x, y + 7, { width: col.nom - 12, ellipsis: true });
    x += col.nom;
    doc.fillColor(COLORS.muted).text(p.email || '—', x, y + 7, {
      width: col.email - 12,
      ellipsis: true,
    });
    x += col.email;
    doc.text(p.direction || '—', x, y + 7, { width: col.direction - 12, ellipsis: true });
    x += col.direction;
    const statutLabel = LIBELLES_PARTICIPANT[p.statut] ?? p.statut;
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').text(statutLabel, x, y + 7, {
      width: col.statut - 12,
      ellipsis: true,
    });
    doc.y = y + rowH;
  });

  doc.moveDown(0.8);
}

/**
 * Génère un PDF A4 professionnel OGEFREM.
 */
export async function genererPdfCompteRendu(input: PdfCompteRenduInput): Promise<Buffer> {
  const { compteRendu, reunion, valideParNom, participants } = input;
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
      margins: { top: 48, bottom: 56, left: 48, right: 48 },
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
    const left = doc.page.margins.left;

    // Bandeau en-tête
    doc.save().rect(0, 0, doc.page.width, 72).fill(COLORS.navy).restore();
    doc
      .fillColor(COLORS.white)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(enTete, left, 18, { width: pageWidth });
    doc
      .fillColor('#E8EEF5')
      .fontSize(9)
      .font('Helvetica')
      .text(sousTitre, left, 40, { width: pageWidth });
    doc
      .save()
      .rect(0, 72, doc.page.width, 4)
      .fill(COLORS.gold)
      .restore();

    doc.y = 92;

    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font('Helvetica')
      .text('COMPTE RENDU DE RÉUNION', { characterSpacing: 1.2 });

    doc.moveDown(0.35);
    doc
      .fillColor(COLORS.navy)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(reunion.titre, { width: pageWidth });

    doc.moveDown(0.7);

    // Encadré métadonnées
    const metaTop = doc.y;
    const metaRows = [
      ['Date', formatDateFr(reunion.date_prevue)],
      ['Lieu', reunion.lieu || '—'],
      ['Type', LIBELLES_TYPE[reunion.type_reunion] ?? reunion.type_reunion],
      ['Statut CR', LIBELLES_STATUT[compteRendu.statut] ?? compteRendu.statut],
      ['Version', String(compteRendu.version)],
    ];
    if (reunion.description?.trim()) {
      metaRows.splice(3, 0, ['Objet', reunion.description.trim()]);
    }
    if (compteRendu.soumis_le) {
      metaRows.push(['Soumis le', formatDateFr(compteRendu.soumis_le)]);
    }
    if (compteRendu.valide_le) {
      metaRows.push([
        'Validé le',
        `${formatDateFr(compteRendu.valide_le)}${valideParNom ? ` — ${valideParNom}` : ''}`,
      ]);
    }

    const metaH = 16 + metaRows.length * 16 + 10;
    doc.save().roundedRect(left, metaTop, pageWidth, metaH, 6).fill(COLORS.soft).restore();
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.8)
      .roundedRect(left, metaTop, pageWidth, metaH, 6)
      .stroke();

    let metaY = metaTop + 12;
    for (const [label, value] of metaRows) {
      doc
        .fillColor(COLORS.muted)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), left + 14, metaY, { width: 90 });
      doc
        .fillColor(COLORS.ink)
        .font('Helvetica')
        .fontSize(9)
        .text(value, left + 110, metaY, { width: pageWidth - 130 });
      metaY += 16;
    }
    doc.y = metaTop + metaH + 18;

    // Sections
    const sectionsAvecParticipants =
      participants &&
      participants.length > 0 &&
      !sections.some((s) => s.cle === 'participants')
        ? [
            ...sections.slice(0, 1),
            { cle: 'participants', libelle: 'Participants' } as SectionCompteRendu,
            ...sections.slice(1),
          ]
        : sections;

    for (const section of sectionsAvecParticipants) {
      drawSectionTitle(doc, section.libelle, pageWidth);

      if (
        section.cle === 'participants' &&
        participants &&
        participants.length > 0
      ) {
        drawParticipantsTable(doc, participants, pageWidth);
        continue;
      }

      if (section.cle === 'participants') {
        const raw = compteRendu.contenu?.[section.cle];
        const texte = htmlVersTexte(typeof raw === 'string' ? raw : '') || 'Aucun participant enregistré.';
        ensureSpace(doc, 40);
        doc
          .fillColor(COLORS.ink)
          .fontSize(10)
          .font('Helvetica')
          .text(texte, { align: 'left', lineGap: 3, paragraphGap: 6 });
        doc.moveDown(0.85);
        continue;
      }

      const raw = compteRendu.contenu?.[section.cle];
      const html =
        typeof raw === 'string'
          ? raw
          : compteRendu.contenu_html && sectionsAvecParticipants.length === 1
            ? compteRendu.contenu_html
            : '';
      const texte = htmlVersTexte(html) || '—';

      ensureSpace(doc, 40);
      doc
        .fillColor(COLORS.ink)
        .fontSize(10)
        .font('Helvetica')
        .text(texte, {
          align: 'left',
          lineGap: 3,
          paragraphGap: 6,
        });
      doc.moveDown(0.85);
    }

    // Pied de page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 34;
      doc
        .strokeColor(COLORS.line)
        .lineWidth(0.7)
        .moveTo(left, bottom - 8)
        .lineTo(left + pageWidth, bottom - 8)
        .stroke();
      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .text(
          `Ogefmeeting · ${enTete} · Généré le ${formatDateCourteFr(new Date().toISOString())}`,
          left,
          bottom,
          { width: pageWidth * 0.7, align: 'left' },
        );
      doc.text(
        `Page ${i - range.start + 1} / ${range.count}`,
        left,
        bottom,
        { width: pageWidth, align: 'right' },
      );
    }

    doc.end();
  });
}
