import type { Request, Response } from 'express';
import Busboy from 'busboy';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { documentsReunionService } from '../services/documents-reunion.service.js';
import { reunionService } from '../services/reunion.service.js';
import { uuidSchema } from '../schemas/common.schemas.js';
import { utilisateurPeutGererConduite } from '../utils/reunion-acces.js';
import {
  obtenirEtatDocumentLive,
} from '../ws/document-broadcast.js';

type DocUploadParsed = {
  reunionId: string;
  file: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
    size: number;
  };
};

function mimeDepuisNom(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.doc')) return 'application/msword';
  return null;
}

async function parseMultipart(req: Request): Promise<DocUploadParsed> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: 50 * 1024 * 1024 },
    });

    let reunionId: string | null = null;
    let typeMimeChamp: string | null = null;
    let fileBuffer: Buffer | null = null;
    let fileSize = 0;
    let fileFilename = '';
    let fileMimeType = '';

    busboy.on('field', (name: string, val: unknown) => {
      if (name === 'reunion_id') reunionId = String(val);
      if (name === 'type_mime') typeMimeChamp = String(val);
    });

    busboy.on(
      'file',
      (
        _name: string,
        file: NodeJS.ReadableStream,
        info: { filename: string; mimeType: string },
      ) => {
        fileFilename = info.filename;
        fileMimeType = info.mimeType;
        const chunks: Buffer[] = [];
        file.on('data', (data: Buffer) => {
          chunks.push(data);
          fileSize += data.length;
        });
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
        file.on('error', reject);
      },
    );

    busboy.on('error', reject);
    busboy.on('finish', () => {
      try {
        if (!reunionId) throw new AppError(400, 'reunion_id manquant.');
        if (!fileBuffer || fileSize === 0) {
          throw new AppError(400, 'Fichier manquant.');
        }
        const mime =
          typeMimeChamp ||
          mimeDepuisNom(fileFilename) ||
          fileMimeType ||
          'application/octet-stream';
        resolve({
          reunionId,
          file: {
            filename: fileFilename || 'document.pdf',
            mimeType: mime,
            buffer: fileBuffer,
            size: fileSize,
          },
        });
      } catch (e) {
        reject(e);
      }
    });

    req.pipe(busboy);
  });
}

async function assurerConduite(req: Request, reunionId: string) {
  if (!req.user) throw new AppError(401, 'Authentification requise.');
  const reunion = await reunionService.obtenirParId(reunionId);
  if (!utilisateurPeutGererConduite(req.user, reunion)) {
    throw new AppError(
      403,
      'Seul l’organisateur ou un ayant-droit peut gérer les documents live.',
    );
  }
  return reunion;
}

const liveSyncSchema = z.object({
  reunion_id: uuidSchema,
  document_id: uuidSchema.nullable().optional(),
  page: z.number().int().min(1).optional(),
  scroll_ratio: z.number().min(0).max(1).optional(),
});

const presenterSchema = z.object({
  reunion_id: uuidSchema,
  document_id: uuidSchema.nullable(),
});

export class DocumentsReunionController {
  async televerser(req: Request, res: Response): Promise<void> {
    const parsed = await parseMultipart(req);
    await assurerConduite(req, parsed.reunionId);
    const data = await documentsReunionService.televerser({
      reunionId: parsed.reunionId,
      fichier: parsed.file,
      televerseParId: req.user!.id,
    });
    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const reunionId = String(req.query.reunion_id ?? '');
    if (!reunionId) throw new AppError(400, 'reunion_id requis.');
    const data = await documentsReunionService.lister(reunionId);
    res.status(200).json({ success: true, data });
  }

  async obtenirUrl(req: Request, res: Response): Promise<void> {
    const data = await documentsReunionService.obtenirUrl(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async supprimer(req: Request, res: Response): Promise<void> {
    const doc = await documentsReunionService.obtenirUrl(req.params.id as string);
    await assurerConduite(req, doc.reunion_id);
    await documentsReunionService.supprimer(doc.id);
    res.status(200).json({ success: true, data: { message: 'Document supprimé.' } });
  }

  async presenter(req: Request, res: Response): Promise<void> {
    const body = presenterSchema.parse(req.body ?? {});
    await assurerConduite(req, body.reunion_id);
    const data = await documentsReunionService.presenter({
      reunionId: body.reunion_id,
      documentId: body.document_id,
    });
    res.status(200).json({ success: true, data });
  }

  async synchroniserLive(req: Request, res: Response): Promise<void> {
    const body = liveSyncSchema.parse(req.body ?? {});
    await assurerConduite(req, body.reunion_id);
    const data = await documentsReunionService.synchroniserLive({
      reunionId: body.reunion_id,
      documentId: body.document_id,
      page: body.page,
      scrollRatio: body.scroll_ratio,
    });
    res.status(200).json({ success: true, data });
  }

  async obtenirLive(req: Request, res: Response): Promise<void> {
    const reunionId = req.params.reunionId as string;
    const memoire = obtenirEtatDocumentLive(reunionId);
    if (memoire.document_id && memoire.url_lecture) {
      res.status(200).json({ success: true, data: memoire });
      return;
    }
    const data = await documentsReunionService.obtenirLive(reunionId);
    res.status(200).json({ success: true, data });
  }
}

export const documentsReunionController = new DocumentsReunionController();
