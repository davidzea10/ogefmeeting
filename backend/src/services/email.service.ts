import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Envoi d’email via Resend si configuré, sinon journalisation (best-effort).
 * Ne lève jamais d’erreur bloquante pour le workflow métier.
 */
export async function envoyerEmail(payload: EmailPayload): Promise<{ envoye: boolean }> {
  const destinataires = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map((e) => e.trim())
    .filter(Boolean);

  if (destinataires.length === 0) {
    return { envoye: false };
  }

  if (!env.RESEND_API_KEY) {
    logger.info(
      {
        email: {
          mode: 'simulation',
          to: destinataires,
          subject: payload.subject,
          text: payload.text ?? payload.html.replace(/<[^>]+>/g, ' ').slice(0, 400),
        },
      },
      'Email simulé (RESEND_API_KEY absent)',
    );
    return { envoye: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: destinataires,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn({ status: response.status, body }, 'Échec envoi email Resend');
      return { envoye: false };
    }

    return { envoye: true };
  } catch (error) {
    logger.warn({ err: error }, 'Erreur réseau envoi email');
    return { envoye: false };
  }
}
