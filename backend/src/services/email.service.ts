import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/errors.js';

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Si true : refuse le mode simulation (clé Resend obligatoire + envoi réussi). */
  exigerReel?: boolean;
};

export function emailConfigure(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** Gabarit HTML simple OGEFREM pour tous les mails applicatifs. */
export function modeleEmailHtml(opts: {
  titre: string;
  message: string;
  boutonLibelle?: string;
  boutonUrl?: string;
  pied?: string;
}): string {
  const bouton =
    opts.boutonUrl && opts.boutonLibelle
      ? `<p style="margin:24px 0">
          <a href="${escapeHtml(opts.boutonUrl)}"
             style="display:inline-block;background:#003366;color:#fff;text-decoration:none;
                    padding:12px 20px;border-radius:8px;font-weight:600">
            ${escapeHtml(opts.boutonLibelle)}
          </a>
        </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <tr>
            <td style="background:#003366;color:#fff;padding:18px 24px;font-size:18px;font-weight:700">
              Ogefmeeting — OGEFREM
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#111;font-size:15px;line-height:1.5">
              <h1 style="margin:0 0 12px;font-size:18px;color:#003366">${escapeHtml(opts.titre)}</h1>
              <p style="margin:0 0 12px;white-space:pre-wrap">${escapeHtml(opts.message)}</p>
              ${bouton}
              <p style="margin:24px 0 0;color:#666;font-size:12px">
                ${escapeHtml(opts.pied ?? 'Message automatique — ne pas répondre à cet email.')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envoi d’email via Resend si configuré, sinon journalisation (best-effort).
 * Ne lève jamais d’erreur bloquante pour le workflow métier.
 */
export async function envoyerEmail(
  payload: EmailPayload,
): Promise<{ envoye: boolean; id?: string; mode: 'resend' | 'simulation' }> {
  const destinataires = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (destinataires.length === 0) {
    return { envoye: false, mode: 'simulation' };
  }

  if (!env.RESEND_API_KEY) {
    if (payload.exigerReel) {
      throw new AppError(
        503,
        'Envoi email impossible : configurez RESEND_API_KEY (Resend) sur le serveur. Aucune simulation pour les invitations.',
      );
    }
    logger.info(
      {
        email: {
          mode: 'simulation',
          to: destinataires,
          subject: payload.subject,
          text: payload.text ?? payload.html.replace(/<[^>]+>/g, ' ').slice(0, 400),
        },
      },
      'Email simulé (RESEND_API_KEY absent) — configurez Resend pour un envoi réel',
    );
    return { envoye: false, mode: 'simulation' };
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

    const bodyText = await response.text();
    let parsed: { id?: string; message?: string } = {};
    try {
      parsed = JSON.parse(bodyText) as { id?: string; message?: string };
    } catch {
      /* ignore */
    }

    if (!response.ok) {
      logger.warn(
        { status: response.status, body: bodyText },
        'Échec envoi email Resend',
      );
      if (payload.exigerReel) {
        throw new AppError(
          502,
          `Échec Resend (${response.status}). Vérifiez EMAIL_FROM (domaine vérifié) et la clé API. ${parsed.message ?? ''}`.trim(),
        );
      }
      return { envoye: false, mode: 'resend' };
    }

    logger.info(
      { to: destinataires, subject: payload.subject, id: parsed.id },
      'Email Resend envoyé',
    );
    return { envoye: true, id: parsed.id, mode: 'resend' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn({ err: error }, 'Erreur réseau envoi email');
    if (payload.exigerReel) {
      throw new AppError(502, 'Erreur réseau lors de l’envoi email Resend.');
    }
    return { envoye: false, mode: 'resend' };
  }
}

/** Envoi pratique avec gabarit OGEFREM. */
export async function envoyerEmailOgefmeeting(opts: {
  to: string | string[];
  subject: string;
  titre: string;
  message: string;
  lien?: string | null;
  boutonLibelle?: string;
  /** Invitations : true — pas de simulation. */
  exigerReel?: boolean;
}): Promise<{ envoye: boolean; mode: 'resend' | 'simulation' }> {
  const url = opts.lien
    ? opts.lien.startsWith('http')
      ? opts.lien
      : `${env.FRONTEND_URL}${opts.lien.startsWith('/') ? '' : '/'}${opts.lien}`
    : undefined;

  const html = modeleEmailHtml({
    titre: opts.titre,
    message: opts.message,
    boutonLibelle: opts.boutonLibelle ?? (url ? 'Ouvrir Ogefmeeting' : undefined),
    boutonUrl: url,
  });

  return envoyerEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    text: `${opts.titre}\n\n${opts.message}${url ? `\n\nLien : ${url}` : ''}`,
    exigerReel: opts.exigerReel,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
