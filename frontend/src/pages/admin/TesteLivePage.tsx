import { Button } from '@/components/ui/Button';
import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { preparerTesteLive } from '@/lib/reunions-api';
import { Radio } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Page admin : lance / réutilise une réunion live DANTIC pour tester
 * l’enregistrement audio (et plus tard les modules IA).
 */
export function TesteLivePage() {
  const navigate = useNavigate();
  const announce = useAnnouncerStore((s) => s.announce);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancer() {
    setErreur(null);
    setLoading(true);
    try {
      const reunion = await preparerTesteLive();
      announce('Réunion de test DANTIC prête.');
      navigate(`/reunions/${reunion.id}/live`, { replace: true });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Impossible de préparer le test live.';
      setErreur(msg);
      announce(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Administration · DANTIC
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text">Teste live</h1>
        <p className="mt-2 text-sm text-text-muted">
          Ouvre une réunion de test déjà démarrée (direction DANTIC) pour valider
          l’enregistrement audio. Les modules IA (transcription, empreinte vocale)
          pourront s’y brancher ensuite.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <ul className="space-y-2 text-sm text-text-muted">
          <li>• Direction chargée : <strong className="text-text">DANTIC</strong></li>
          <li>• Statut : réunion mise <strong className="text-text">en cours</strong></li>
          <li>• Usage : micro, upload, préécoute (puis IA plus tard)</li>
        </ul>

        {erreur && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {erreur}
          </p>
        )}

        <div className="mt-6">
          <Button loading={loading} onClick={() => void lancer()}>
            <Radio className="h-4 w-4" aria-hidden />
            Lancer le mode live
          </Button>
        </div>
      </div>
    </div>
  );
}
