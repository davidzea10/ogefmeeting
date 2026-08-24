import PDFDocument from 'pdfkit';
import type { CompteRendu, Reunion, SectionCompteRendu } from '@ogefmeeting/shared';

const SECTIONS_DEFAUT: SectionCompteRendu[] = [
  { cle: 'contexte', libelle: 'Introduction' },
  { cle: 'participants', libelle: 'Participants' },
  { cle: 'ordre_du_jour', libelle: 'Points de l’ordre du jour' },
  { cle: 'conclusion', libelle: 'Conclusion' },
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
  navy: '#0A2F5C',
  blue: '#145A9E',
  gold: '#C9A227',
  ink: '#1C2430',
  muted: '#5A6A7A',
  line: '#D5DEE8',
  soft: '#F5F8FB',
  softBlue: '#EAF1F8',
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

export type BlocPdf =
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'p'; text: string }
  | { type: 'li'; text: string };

/** Convertit un fragment HTML TipTap en blocs typographiques pour le PDF. */
export function htmlVersBlocs(html: string | null | undefined): BlocPdf[] {
  if (!html) return [];
  const normalized = html
    .replace(/\r/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const blocs: BlocPdf[] = [];
  const re = /<(h[1-6]|p|li|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!inner) continue;
    if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
      blocs.push({ type: 'h4', text: inner });
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      blocs.push({ type: 'h3', text: inner });
    } else if (tag === 'li') {
      blocs.push({ type: 'li', text: inner });
    } else {
      blocs.push({ type: 'p', text: inner });
    }
  }

  if (blocs.length === 0) {
    const plain = htmlVersTexte(html);
    if (plain) {
      for (const part of plain.split(/\n{2,}/)) {
        const t = part.trim();
        if (t) blocs.push({ type: 'p', text: t });
      }
    }
  }
  return blocs;
}

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
  ensureSpace(doc, 52);
  const y = doc.y;
  const left = doc.page.margins.left;

  doc.save().roundedRect(left, y, pageWidth, 28, 4).fill(COLORS.softBlue).restore();
  doc.save().rect(left, y, 5, 28).fill(COLORS.gold).restore();

  doc
    .fillColor(COLORS.navy)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(title.toUpperCase(), left + 16, y + 8, {
      width: pageWidth - 28,
      characterSpacing: 0.6,
    });

  doc.y = y + 38;
}

function drawPointTitle(doc: PDFKit.PDFDocument, text: string, pageWidth: number) {
  ensureSpace(doc, 36);
  const left = doc.page.margins.left;
  const y = doc.y;

  doc
    .fillColor(COLORS.blue)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(text, left, y, { width: pageWidth });

  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.6)
    .moveTo(left, doc.y + 4)
    .lineTo(left + Math.min(pageWidth, 220), doc.y + 4)
    .stroke();

  doc.moveDown(0.55);
}

function drawSousPointTitle(doc: PDFKit.PDFDocument, text: string, pageWidth: number) {
  ensureSpace(doc, 28);
  const left = doc.page.margins.left + 12;
  doc
    .fillColor(COLORS.navy)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(text, left, doc.y, { width: pageWidth - 12 });
  doc.moveDown(0.35);
}

function renderBlocs(doc: PDFKit.PDFDocument, blocs: BlocPdf[], pageWidth: number) {
  const left = doc.page.margins.left;
  for (const bloc of blocs) {
    if (bloc.type === 'h3') {
      drawPointTitle(doc, bloc.text, pageWidth);
      continue;
    }
    if (bloc.type === 'h4') {
      drawSousPointTitle(doc, bloc.text, pageWidth);
      continue;
    }
    ensureSpace(doc, 28);
    if (bloc.type === 'li') {
      doc
        .fillColor(COLORS.ink)
        .fontSize(10)
        .font('Helvetica')
        .text(`•  ${bloc.text}`, left + 8, doc.y, {
          width: pageWidth - 8,
          align: 'justify',
          lineGap: 3,
        });
    } else {
      doc
        .fillColor(COLORS.ink)
        .fontSize(10)
        .font('Helvetica')
        .text(bloc.text, left, doc.y, {
          width: pageWidth,
          align: 'justify',
          lineGap: 3.5,
          paragraphGap: 8,
        });
    }
    doc.moveDown(0.45);
  }
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
  const rowH = 24;
  const headerH = 26;

  const drawHeader = () => {
    ensureSpace(doc, headerH + 8);
    const y = doc.y;
    doc.save().roundedRect(left, y, pageWidth, headerH, 3).fill(COLORS.navy).restore();
    doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold');
    let x = left + 10;
    doc.text('NOM', x, y + 9, { width: col.nom - 14 });
    x += col.nom;
    doc.text('EMAIL', x, y + 9, { width: col.email - 14 });
    x += col.email;
    doc.text('DIRECTION', x, y + 9, { width: col.direction - 14 });
    x += col.direction;
    doc.text('STATUT', x, y + 9, { width: col.statut - 14 });
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
      .lineWidth(0.4)
      .moveTo(left, y + rowH)
      .lineTo(left + pageWidth, y + rowH)
      .stroke();

    doc.fillColor(COLORS.ink).fontSize(8.5).font('Helvetica');
    let x = left + 10;
    doc.text(p.nom || '—', x, y + 8, { width: col.nom - 14, ellipsis: true });
    x += col.nom;
    doc.fillColor(COLORS.muted).text(p.email || '—', x, y + 8, {
      width: col.email - 14,
      ellipsis: true,
    });
    x += col.email;
    doc.text(p.direction || '—', x, y + 8, { width: col.direction - 14, ellipsis: true });
    x += col.direction;
    const statutLabel = LIBELLES_PARTICIPANT[p.statut] ?? p.statut;
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').text(statutLabel, x, y + 8, {
      width: col.statut - 14,
      ellipsis: true,
    });
    doc.y = y + rowH;
  });

  doc.moveDown(1);
}

/**
 * Génère un PDF A4 professionnel OGEFREM.
 */
export async function genererPdfCompteRendu(input: PdfCompteRenduInput): Promise<Buffer> {
  const { compteRendu, reunion, valideParNom, participants } = input;
  const sections =
    input.sections && input.sections.length > 0
      ? input.sections.filter((s) => s.cle !== 'decisions' && s.cle !== 'actions')
      : SECTIONS_DEFAUT;
  const enTete = input.enTetePdf?.trim() || 'OGEFREM';
  const sousTitre =
    input.sousTitrePdf?.trim() ||
    'Office de Gestion du Fret Multimodal — République Démocratique du Congo';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 52, bottom: 62, left: 52, right: 52 },
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
    const colGap = 16;
    const colRightW = Math.floor(pageWidth * 0.34);
    const colLeftW = pageWidth - colRightW - colGap;
    const colRightX = left + colLeftW + colGap;

    // En-tête institutionnel — deux colonnes, hauteur dynamique (évite les superpositions)
    const headerPadTop = 12;
    const headerPadBottom = 14;
    const labelH = doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .heightOfString('DOCUMENT OFFICIEL', { width: colLeftW, characterSpacing: 1.5 });
    const enTeteH = doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .heightOfString(enTete, { width: colLeftW, lineGap: 1 });
    const sousTitreH = doc
      .fontSize(8)
      .font('Helvetica')
      .heightOfString(sousTitre, { width: colRightW, align: 'right', lineGap: 1.5 });
    const versionH = doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .heightOfString(`Version ${compteRendu.version}`, { width: colRightW, align: 'right' });
    const leftBlockH = labelH + 6 + enTeteH;
    const rightBlockH = sousTitreH + 8 + versionH;
    const headerBandH = Math.max(78, headerPadTop + Math.max(leftBlockH, rightBlockH) + headerPadBottom);

    doc.save().rect(0, 0, doc.page.width, headerBandH).fill(COLORS.navy).restore();

    let yLeft = headerPadTop;
    doc
      .fillColor(COLORS.gold)
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .text('DOCUMENT OFFICIEL', left, yLeft, { width: colLeftW, characterSpacing: 1.5 });
    yLeft += labelH + 6;

    doc
      .fillColor(COLORS.white)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(enTete, left, yLeft, { width: colLeftW, lineGap: 1 });

    let yRight = headerPadTop;
    doc
      .fillColor('#C8D7E8')
      .fontSize(8)
      .font('Helvetica')
      .text(sousTitre, colRightX, yRight, { width: colRightW, align: 'right', lineGap: 1.5 });
    yRight += sousTitreH + 8;

    doc
      .fillColor(COLORS.white)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(`Version ${compteRendu.version}`, colRightX, yRight, { width: colRightW, align: 'right' });

    doc.save().rect(0, headerBandH, doc.page.width, 4).fill(COLORS.gold).restore();

    doc.y = headerBandH + 18;

    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('COMPTE RENDU DE RÉUNION', { characterSpacing: 1.4 });

    doc.moveDown(0.35);
    doc
      .fillColor(COLORS.navy)
      .fontSize(17)
      .font('Helvetica-Bold')
      .text(reunion.titre, { width: pageWidth, lineGap: 2 });

    doc.moveDown(0.75);

    // Encadré métadonnées
    const metaTop = doc.y;
    const metaRows: Array<[string, string]> = [
      ['Date', formatDateFr(reunion.date_prevue)],
      ['Lieu', reunion.lieu || '—'],
      ['Type', LIBELLES_TYPE[reunion.type_reunion] ?? reunion.type_reunion],
      ['Statut', LIBELLES_STATUT[compteRendu.statut] ?? compteRendu.statut],
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

    const metaH = 18 + metaRows.length * 17 + 12;
    doc.save().roundedRect(left, metaTop, pageWidth, metaH, 8).fill(COLORS.soft).restore();
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.9)
      .roundedRect(left, metaTop, pageWidth, metaH, 8)
      .stroke();

    let metaY = metaTop + 14;
    for (const [label, value] of metaRows) {
      doc
        .fillColor(COLORS.muted)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), left + 16, metaY, { width: 88 });
      doc
        .fillColor(COLORS.ink)
        .font('Helvetica')
        .fontSize(9.5)
        .text(value, left + 108, metaY, { width: pageWidth - 130 });
      metaY += 17;
    }
    doc.y = metaTop + metaH + 22;

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

      if (section.cle === 'participants' && participants && participants.length > 0) {
        drawParticipantsTable(doc, participants, pageWidth);
        continue;
      }

      const raw = compteRendu.contenu?.[section.cle];
      const html =
        typeof raw === 'string'
          ? raw
          : compteRendu.contenu_html && sectionsAvecParticipants.length === 1
            ? compteRendu.contenu_html
            : '';

      const blocs = htmlVersBlocs(html);
      if (blocs.length === 0) {
        ensureSpace(doc, 28);
        doc
          .fillColor(COLORS.muted)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('—', { width: pageWidth });
        doc.moveDown(0.8);
        continue;
      }

      renderBlocs(doc, blocs, pageWidth);
      doc.moveDown(0.55);
    }

    // Bloc signature
    ensureSpace(doc, 90);
    doc.moveDown(0.6);
    const sigY = doc.y;
    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.8)
      .moveTo(left, sigY)
      .lineTo(left + pageWidth, sigY)
      .stroke();
    doc.y = sigY + 14;
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font('Helvetica')
      .text('Validation', left, doc.y, { width: pageWidth / 2 });
    doc.text('Secrétariat / Direction', left + pageWidth / 2, doc.y, {
      width: pageWidth / 2,
    });
    doc.moveDown(2.2);
    doc
      .strokeColor(COLORS.muted)
      .lineWidth(0.6)
      .moveTo(left, doc.y)
      .lineTo(left + pageWidth * 0.35, doc.y)
      .stroke();
    doc
      .moveTo(left + pageWidth / 2, doc.y)
      .lineTo(left + pageWidth / 2 + pageWidth * 0.35, doc.y)
      .stroke();
    doc.moveDown(0.4);
    doc
      .fillColor(COLORS.muted)
      .fontSize(7.5)
      .text('Nom et signature', left)
      .text('Nom et signature', left + pageWidth / 2);

    // Pied de page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 36;
      doc.save().rect(0, doc.page.height - 28, doc.page.width, 28).fill(COLORS.navy).restore();
      doc
        .fontSize(7.5)
        .fillColor('#C8D7E8')
        .font('Helvetica')
        .text(
          `${enTete} · Ogefmeeting · ${formatDateCourteFr(new Date().toISOString())}`,
          left,
          bottom + 2,
          { width: pageWidth * 0.7, align: 'left' },
        );
      doc
        .fillColor(COLORS.white)
        .text(`Page ${i - range.start + 1} / ${range.count}`, left, bottom + 2, {
          width: pageWidth,
          align: 'right',
        });
    }

    doc.end();
  });
}
