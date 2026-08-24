import type { Request, Response } from 'express';
import Busboy from 'busboy';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { enregistrementsService } from '../services/enregistrements.service.js';
import { uuidSchema } from '../schemas/common.schemas.js';

const televerserEnregistrementFieldSchema = z.object({
  reunion_id: uuidSchema,
  type_mime: z.string().optional().nullable(),
  duree_secondes: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
      message: 'duree_secondes invalide',
    }),
});

const listerQuerySchema = z.object({
  reunion_id: uuidSchema,
});

type AudioUploadParsed = {
  reunionId: string;
  dureeSecondes: number | null;
  file: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
    size: number;
  };
};

function mimeDepuisNom(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  return null;
}

async function parseMultipartTeleverser(req: Request): Promise<AudioUploadParsed> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: 200 * 1024 * 1024,
      },
    });

    let reunionId: string | null = null;
    let dureeSecondes: number | null = null;
    let typeMimeChamp: string | null = null;

    let fileBuffer: Buffer | null = null;
    let fileSize = 0;
    let fileFilename = '';
    let fileMimeType = '';

    busboy.on('field', (name: string, val: unknown) => {
      if (name === 'reunion_id') reunionId = String(val);
      if (name === 'type_mime') typeMimeChamp = String(val);
      if (name === 'duree_secondes') {
        const n = Number(String(val));
        dureeSecondes = Number.isFinite(n) ? n : null;
      }
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
        if (!fileBuffer) throw new AppError(400, 'Fichier audio manquant.');

        const payload: Record<string, unknown> = { reunion_id: reunionId };
        if (dureeSecondes != null) payload.duree_secondes = String(dureeSecondes);
        if (typeMimeChamp) payload.type_mime = typeMimeChamp;

        const parsed = televerserEnregistrementFieldSchema.parse(payload);

        const mimeResolu =
          parsed.type_mime?.trim() ||
          (fileMimeType && !fileMimeType.includes('octet-stream') ? fileMimeType : null) ||
          mimeDepuisNom(fileFilename) ||
          'audio/webm';

        resolve({
          reunionId: parsed.reunion_id,
          dureeSecondes: parsed.duree_secondes,
          file: {
            filename: fileFilename || 'audio.webm',
            mimeType: mimeResolu,
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

export class EnregistrementsController {
  async televerser(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');

    const parsed = await parseMultipartTeleverser(req);
    const data = await enregistrementsService.televerser({
      reunionId: parsed.reunionId,
      fichier: parsed.file,
      dureeSecondes: parsed.dureeSecondes,
      televerseParId: req.user.id,
    });

    res.status(201).json({ success: true, data });
  }

  async lister(req: Request, res: Response): Promise<void> {
    const query = listerQuerySchema.parse(req.query);
    const data = await enregistrementsService.listerParReunion(query.reunion_id);
    res.status(200).json({ success: true, data });
  }

  async obtenirUrlLecture(req: Request, res: Response): Promise<void> {
    const data = await enregistrementsService.obtenirUrlLecture(req.params.id as string);
    res.status(200).json({ success: true, data });
  }

  async supprimer(req: Request, res: Response): Promise<void> {
    await enregistrementsService.supprimer(req.params.id as string);
    res.status(200).json({ success: true, data: { message: 'Enregistrement supprimé.' } });
  }
}

export const enregistrementsController = new EnregistrementsController();
