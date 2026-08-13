import { Button } from '@/components/ui/Button';
import { telechargerPdfCompteRendu } from '@/lib/comptes-rendus-api';
import type { NotificationApp } from '@ogefmeeting/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';

type Props = {
  notification: NotificationApp;
  libelleType: string;
  dateLabel?: string;
  onNavigate?: () => void;
  onMarkRead?: (id: string) => void;
  compact?: boolean;
  showUnreadBadge?: boolean;
};

function compteRenduId(n: NotificationApp): string | null {
  const id = n.metadonnees?.compte_rendu_id;
  return typeof id === 'string' ? id : null;
}

export function notificationAvecActionsCr(n: NotificationApp): boolean {
  const crId = compteRenduId(n);
  return (
    Boolean(crId) &&
    (n.type === 'cr_disponible' || n.type === 'cr_publie' || n.type === 'cr_valide')
  );
}

export function NotificationItemActions({
  notification,
  libelleType,
  dateLabel,
  onNavigate,
  onMarkRead,
  compact = false,
  showUnreadBadge = false,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const crId = compteRenduId(notification);

  const markIfNeeded = () => {
    if (!notification.est_lu) onMarkRead?.(notification.id);
  };

  async function handleDownload() {
    if (!crId) return;
    markIfNeeded();
    onNavigate?.();
    setDownloading(true);
    try {
      const { blob, filename } = await telechargerPdfCompteRendu(crId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={compact ? 'px-3 py-2.5' : 'px-4 py-3'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {libelleType}
        </p>
        {dateLabel && (
          <p className="text-[11px] text-text-muted">{dateLabel}</p>
        )}
      </div>

      <p className={compact ? 'text-sm font-medium text-text' : 'mt-0.5 font-semibold text-text'}>
        {notification.titre}
      </p>
      <p
        className={
          compact
            ? 'mt-0.5 line-clamp-2 text-xs text-text-muted'
            : 'mt-0.5 text-sm text-text-muted'
        }
      >
        {notification.message}
      </p>

      {crId && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="secondary"
            loading={downloading}
            onClick={() => void handleDownload()}
          >
            {!downloading && <Download className="h-3.5 w-3.5" aria-hidden />}
            Télécharger PDF
          </Button>
        </div>
      )}

      {showUnreadBadge && !notification.est_lu && (
        <span className="mt-2 inline-flex rounded-md bg-ogefrem-blue/10 px-2 py-0.5 text-xs font-medium text-ogefrem-blue">
          Non lu
        </span>
      )}
    </div>
  );
}
