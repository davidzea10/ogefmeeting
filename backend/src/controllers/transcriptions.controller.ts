import type { Request, Response } from 'express';
import { isDeepgramConfigured } from '../services/deepgram.service.js';
import { transcriptionsService } from '../services/transcriptions.service.js';
import { reunionService } from '../services/reunion.service.js';
import {
  obtenirEtatTranscriptionLive,
  publierTranscriptionLive,
} from '../ws/transcription-broadcast.js';
import { AppError } from '../utils/errors.js';
import {
  profilLimiteAuxParticipations,
  utilisateurPeutApprouver,
  utilisateurPeutGererConduite,
} from '../utils/reunion-acces.js';

function peutVoirArchives(
  user: Request['user'],
  creePar: string | null,
): boolean {
  if (!user) return false;
  if (user.role === 'administrateur') return true;
  if (creePar && user.id === creePar) return true;
  return utilisateurPeutApprouver(user);
}

/**
 * Contrôleur Transcriptions.
 */
export class TranscriptionsController {
  /** Indique si la transcription live (Deepgram) est disponible. */
  async statutStt(_req: Request, res: Response): Promise<void> {
    const disponible = isDeepgramConfigured();
    res.status(200).json({
      success: true,
      data: {
        disponible,
        message: disponible
          ? null
          : 'Transcription live indisponible : ajoutez DEEPGRAM_API_KEY dans le .env du backend.',
      },
    });
  }

  async sauvegarder(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');

    const body = req.body as {
      reunion_id: string;
      langue: string;
      texte_complet: string;
      enregistrement_id?: string | null;
    };

    const reunion = await reunionService.obtenirParId(body.reunion_id);
    if (!utilisateurPeutGererConduite(req.user, reunion)) {
      throw new AppError(403, 'Droits insuffisants pour sauvegarder une transcription.');
    }

    const data = await transcriptionsService.sauvegarder(body);
    res.status(201).json({ success: true, data });
  }

  async listerParReunion(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');
    const reunionId = req.params.reunionId as string;
    const reunion = await reunionService.obtenirParId(reunionId);

    if (!peutVoirArchives(req.user, reunion.cree_par)) {
      throw new AppError(
        403,
        'Seuls l’administrateur ou l’organisateur peuvent consulter les transcriptions.',
      );
    }

    const data = await transcriptionsService.listerParReunion(reunionId);
    res.status(200).json({ success: true, data });
  }

  /** Diffuse le texte STT en cours à tous les participants (organisateur / ayant-droit). */
  async synchroniserLive(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');

    const body = req.body as {
      reunion_id: string;
      texte_complet: string;
      texte_interim?: string | null;
    };

    const reunion = await reunionService.obtenirParId(body.reunion_id);
    if (!utilisateurPeutGererConduite(req.user, reunion)) {
      throw new AppError(403, 'Droits insuffisants pour publier la transcription live.');
    }

    await reunionService.synchroniserTranscriptionLive(
      body.reunion_id,
      body.texte_complet ?? '',
      body.texte_interim ?? null,
    );

    publierTranscriptionLive(
      body.reunion_id,
      body.texte_complet ?? '',
      body.texte_interim ?? '',
    );

    res.status(200).json({ success: true, data: { ok: true } });
  }

  /** Lecture STT live pour tous les participants (fallback polling). */
  async obtenirLive(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new AppError(401, 'Authentification requise.');

    const reunionId = req.params.reunionId as string;
    const reunion = await reunionService.obtenirParId(reunionId, {
      limiterAuProfilId: profilLimiteAuxParticipations(req.user),
    });

    const memoire = obtenirEtatTranscriptionLive(reunionId);
    const dbTexte = reunion.transcription_live_texte ?? '';
    const dbInterim = reunion.transcription_live_interim ?? '';
    const texte_complet =
      memoire.texte_complet.length >= dbTexte.length ? memoire.texte_complet : dbTexte;
    const interim = memoire.interim || dbInterim;

    res.status(200).json({
      success: true,
      data: { texte_complet, interim },
    });
  }
}

export const transcriptionsController = new TranscriptionsController();
