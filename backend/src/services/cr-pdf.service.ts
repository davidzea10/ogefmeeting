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
  matricule?: string | null;
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

export function nomFichierPdfParticipants(reunionTitre: string, version: number): string {
  const base = slugify(reunionTitre) || 'reunion';
  return `participants-${base}-v${version}.pdf`;
}

export type PdfListeParticipantsInput = {
  compteRendu: CompteRendu;
  reunion: Pick<Reunion, 'titre' | 'date_prevue' | 'lieu'>;
  participants: PdfParticipantLigne[];
  enTetePdf?: string | null;
  sousTitrePdf?: string | null;
};

/** PDF annexe : liste des participants uniquement (envoi / impression séparés). */
export async function genererPdfListeParticipants(
  input: PdfListeParticipantsInput,
): Promise<Buffer> {
  const { compteRendu, reunion, participants } = input;
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
        Title: `Participants — ${reunion.titre}`,
        Author: 'Ogefmeeting / OGEFREM',
        Subject: 'Liste des participants',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    const headerBandH = 72;
    doc.save().rect(0, 0, doc.page.width, headerBandH).fill(COLORS.navy).restore();
    doc
      .fillColor(COLORS.white)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(enTete, left, 16, { width: pageWidth * 0.55 });
    doc
      .fillColor('#C8D7E8')
      .fontSize(8)
      .font('Helvetica')
      .text(sousTitre, left + pageWidth * 0.45, 16, {
        width: pageWidth * 0.55,
        align: 'right',
        lineGap: 1.5,
      });
    doc.save().rect(0, headerBandH, doc.page.width, 4).fill(COLORS.gold).restore();
    doc.y = headerBandH + 20;

    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('LISTE DES PARTICIPANTS', { characterSpacing: 1.2 });
    doc.moveDown(0.35);
    doc
      .fillColor(COLORS.navy)
      .fontSize(15)
      .font('Helvetica-Bold')
      .text(reunion.titre, { width: pageWidth, lineGap: 2 });
    doc.moveDown(0.5);
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font('Helvetica')
      .text(
        `${formatDateFr(reunion.date_prevue)}${reunion.lieu ? ` · ${reunion.lieu}` : ''} · Version ${compteRendu.version}`,
        { width: pageWidth },
      );
    doc.moveDown(1.2);

    drawParticipantsTable(doc, participants, pageWidth);

    drawFooters(doc, pageWidth, left, enTete);

    doc.end();
  });
}

function bottomLimit(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  // Évite une page quasi vide : n’ajoute une page que s’il reste vraiment trop peu d’espace.
  const restant = bottomLimit(doc) - doc.y;
  if (restant < Math.min(needed, 36)) {
    doc.addPage();
  }
}

function drawFooters(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  left: number,
  enTete: string,
) {
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
        { width: pageWidth * 0.7, align: 'left', lineBreak: false },
      );
    doc
      .fillColor(COLORS.white)
      .text(`Page ${i - range.start + 1} / ${range.count}`, left, bottom + 2, {
        width: pageWidth,
        align: 'right',
        lineBreak: false,
      });
  }
}

function drawSignatureBlock(doc: PDFKit.PDFDocument, pageWidth: number) {
  const left = doc.page.margins.left;
  const blockH = 58;
  const restant = bottomLimit(doc) - doc.y;
  // Si la place est juste insuffisante mais > 40pt, on compacte sur la page courante
  // plutôt que d’ouvrir une page presque vide pour la seule signature.
  if (restant < blockH && restant < 40) {
    doc.addPage();
  }

  const sigY = doc.y;
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.8)
    .moveTo(left, sigY)
    .lineTo(left + pageWidth, sigY)
    .stroke();

  const labelY = sigY + 12;
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica');
  doc.text('Validation', left, labelY, { width: pageWidth / 2, lineBreak: false });
  doc.text('Secrétariat / Direction', left + pageWidth / 2, labelY, {
    width: pageWidth / 2,
    lineBreak: false,
  });

  const lineY = labelY + 26;
  doc
    .strokeColor(COLORS.muted)
    .lineWidth(0.6)
    .moveTo(left, lineY)
    .lineTo(left + pageWidth * 0.35, lineY)
    .stroke();
  doc
    .moveTo(left + pageWidth / 2, lineY)
    .lineTo(left + pageWidth / 2 + pageWidth * 0.35, lineY)
    .stroke();

  doc
    .fillColor(COLORS.muted)
    .fontSize(7.5)
    .text('Nom et signature', left, lineY + 8, { lineBreak: false })
    .text('Nom et signature', left + pageWidth / 2, lineY + 8, { lineBreak: false });

  doc.y = lineY + 24;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, pageWidth: number) {
  const left = doc.page.margins.left;
  doc.fontSize(11).font('Helvetica-Bold');
  const titleH = doc.heightOfString(title.toUpperCase(), {
    width: pageWidth - 28,
    characterSpacing: 0.6,
  });
  const blockH = Math.max(28, titleH + 16);
  ensureSpace(doc, blockH + 8);

  const y = doc.y;
  doc.save().roundedRect(left, y, pageWidth, blockH, 4).fill(COLORS.softBlue).restore();
  doc.save().rect(left, y, 5, blockH).fill(COLORS.gold).restore();

  doc
    .fillColor(COLORS.navy)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(title.toUpperCase(), left + 16, y + 8, {
      width: pageWidth - 28,
      characterSpacing: 0.6,
      lineBreak: true,
    });

  doc.y = y + blockH + 8;
}

function drawPointTitle(doc: PDFKit.PDFDocument, text: string, pageWidth: number) {
  doc.fillColor(COLORS.blue).fontSize(11).font('Helvetica-Bold');
  const h = doc.heightOfString(text, { width: pageWidth });
  ensureSpace(doc, h + 14);
  const left = doc.page.margins.left;
  doc.text(text, { width: pageWidth });
  const y = doc.y;
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.6)
    .moveTo(left, y + 2)
    .lineTo(left + Math.min(pageWidth, 220), y + 2)
    .stroke();
  doc.y = y + 10;
}

function drawSousPointTitle(doc: PDFKit.PDFDocument, text: string, pageWidth: number) {
  doc.fillColor(COLORS.navy).fontSize(10).font('Helvetica-Bold');
  const h = doc.heightOfString(text, { width: pageWidth - 12 });
  ensureSpace(doc, h + 8);
  doc.text(text, { indent: 12, width: pageWidth - 12 });
  doc.moveDown(0.25);
}

function renderBlocs(doc: PDFKit.PDFDocument, blocs: BlocPdf[], pageWidth: number) {
  for (const bloc of blocs) {
    if (bloc.type === 'h3') {
      drawPointTitle(doc, bloc.text, pageWidth);
      continue;
    }
    if (bloc.type === 'h4') {
      drawSousPointTitle(doc, bloc.text, pageWidth);
      continue;
    }
    if (bloc.type === 'li') {
      doc.fillColor(COLORS.ink).fontSize(10).font('Helvetica');
      doc.text(`•  ${bloc.text}`, {
        indent: 8,
        width: pageWidth - 8,
        align: 'justify',
        lineGap: 3,
        paragraphGap: 4,
      });
    } else {
      doc
        .fillColor(COLORS.ink)
        .fontSize(10)
        .font('Helvetica')
        .text(bloc.text, {
          width: pageWidth,
          align: 'justify',
          lineGap: 3.5,
          paragraphGap: 6,
        });
    }
    doc.moveDown(0.25);
  }
}

function drawParticipantsTable(
  doc: PDFKit.PDFDocument,
  participants: PdfParticipantLigne[],
  pageWidth: number,
) {
  const left = doc.page.margins.left;
  const col = {
    nom: Math.floor(pageWidth * 0.22),
    matricule: Math.floor(pageWidth * 0.14),
    email: Math.floor(pageWidth * 0.26),
    direction: Math.floor(pageWidth * 0.14),
    statut: Math.floor(pageWidth * 0.24),
  };
  const rowH = 24;
  const headerH = 26;

  const drawHeader = () => {
    ensureSpace(doc, headerH + 4);
    const y = doc.y;
    doc.save().roundedRect(left, y, pageWidth, headerH, 3).fill(COLORS.navy).restore();
    doc.fillColor(COLORS.white).fontSize(7.5).font('Helvetica-Bold');
    let x = left + 8;
    doc.text('NOM', x, y + 9, { width: col.nom - 10 });
    x += col.nom;
    doc.text('MATRICULE', x, y + 9, { width: col.matricule - 8 });
    x += col.matricule;
    doc.text('EMAIL', x, y + 9, { width: col.email - 10 });
    x += col.email;
    doc.text('DIR.', x, y + 9, { width: col.direction - 8 });
    x += col.direction;
    doc.text('STATUT', x, y + 9, { width: col.statut - 10 });
    doc.y = y + headerH;
  };

  drawHeader();

  participants.forEach((p, index) => {
    if (doc.y + rowH > bottomLimit(doc)) {
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

    doc.fillColor(COLORS.ink).fontSize(8).font('Helvetica');
    let x = left + 8;
    doc.text(p.nom || '—', x, y + 8, { width: col.nom - 10, ellipsis: true });
    x += col.nom;
    doc.text(p.matricule?.trim() || '—', x, y + 8, {
      width: col.matricule - 8,
      ellipsis: true,
    });
    x += col.matricule;
    doc.fillColor(COLORS.muted).text(p.email || '—', x, y + 8, {
      width: col.email - 10,
      ellipsis: true,
    });
    x += col.email;
    doc.fillColor(COLORS.ink).text(p.direction || '—', x, y + 8, {
      width: col.direction - 8,
      ellipsis: true,
    });
    x += col.direction;
    const statutLabel = LIBELLES_PARTICIPANT[p.statut] ?? p.statut;
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').text(statutLabel, x, y + 8, {
      width: col.statut - 10,
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

    const inclureParticipantsCorps = compteRendu.afficher_participants_corps !== false;

    let sectionsEffectives = inclureParticipantsCorps
      ? sections
      : sections.filter((s) => s.cle !== 'participants');

    const sectionsAvecParticipants =
      inclureParticipantsCorps &&
      participants &&
      participants.length > 0 &&
      !sectionsEffectives.some((s) => s.cle === 'participants')
        ? [
            ...sectionsEffectives.slice(0, 1),
            { cle: 'participants', libelle: 'Participants' } as SectionCompteRendu,
            ...sectionsEffectives.slice(1),
          ]
        : sectionsEffectives;

    for (const section of sectionsAvecParticipants) {
      drawSectionTitle(doc, section.libelle, pageWidth);

      if (
        inclureParticipantsCorps &&
        section.cle === 'participants' &&
        participants &&
        participants.length > 0
      ) {
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
        doc
          .fillColor(COLORS.muted)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('—', { width: pageWidth });
        doc.moveDown(0.4);
        continue;
      }

      renderBlocs(doc, blocs, pageWidth);
      doc.moveDown(0.35);
    }

    drawSignatureBlock(doc, pageWidth);

    drawFooters(doc, pageWidth, left, enTete);

    doc.end();
  });
}
