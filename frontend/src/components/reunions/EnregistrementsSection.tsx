import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { Button } from '@/components/ui/Button';
import { formatDateHeure } from '@/lib/labels';
import {
  listerEnregistrementsReunion,
  supprimerEnregistrement,
} from '@/lib/enregistrements-api';
import { listerTranscriptionsReunion } from '@/lib/transcriptions-api';
import type { EnregistrementAvecUrl, Transcription } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';

type Props = {
  reunionId: string;
  /** Lecture audio + texte réservée admin / organisateur */
  peutConsulter: boolean;
  peutSupprimer: boolean;
};

function formatDuree(sec: number | null): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

function formatTaille(octets: number | null): string {
  if (octets == null) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(2)} Mo`;
}

function telechargerTexte(nom: string, contenu: string) {
  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export function EnregistrementsSection({
  reunionId,
  peutConsulter,
  peutSupprimer,
}: Props) {
  const queryClient = useQueryClient();
  const [aSupprimer, setASupprimer] = useState<EnregistrementAvecUrl | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [texteOuvertId, setTexteOuvertId] = useState<string | null>(null);

  const audioQuery = useQuery({
    queryKey: ['enregistrements', reunionId],
    queryFn: () => listerEnregistrementsReunion(reunionId),
    enabled: Boolean(reunionId) && peutConsulter,
  });

  const texteQuery = useQuery({
    queryKey: ['transcriptions', reunionId],
    queryFn: () => listerTranscriptionsReunion(reunionId),
    enabled: Boolean(reunionId) && peutConsulter,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => supprimerEnregistrement(id),
    onSuccess: async () => {
      setASupprimer(null);
      if (lectureId === aSupprimer?.id) setLectureId(null);
      await queryClient.invalidateQueries({ queryKey: ['enregistrements', reunionId] });
    },
  });

  if (!peutConsulter) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        Les fichiers audio et texte sont réservés à l’administrateur ou à l’organisateur de
        la réunion.
      </p>
    );
  }

  if (audioQuery.isLoading || texteQuery.isLoading) {
    return <p className="text-sm text-text-muted">Chargement des archives…</p>;
  }

  if (audioQuery.isError) {
    return (
      <p className="text-sm text-danger" role="alert">
        {audioQuery.error instanceof Error ? audioQuery.error.message : 'Erreur audio.'}
      </p>
    );
  }

  const audios = audioQuery.data ?? [];
  const textes: Transcription[] = texteQuery.data ?? [];

  if (audios.length === 0 && textes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        Aucun fichier audio ni transcription. Utilisez le mode live pour enregistrer et
        sauvegarder le texte.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="archives-audio-title">
        <h3 id="archives-audio-title" className="text-base font-semibold text-text">
          Fichiers audio
        </h3>
        {audios.length === 0 ? (
          <p className="text-sm text-text-muted">Aucun enregistrement audio.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm">
            {audios.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{e.nom_fichier}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatDateHeure(e.cree_le)} · {formatDuree(e.duree_secondes)} ·{' '}
                      {formatTaille(e.taille_octets)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {e.url_lecture && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setLectureId(lectureId === e.id ? null : e.id)}
                      >
                        {lectureId === e.id ? 'Masquer' : 'Écouter'}
                      </Button>
                    )}
                    {peutSupprimer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger/10"
                        onClick={() => setASupprimer(e)}
                        aria-label={`Supprimer ${e.nom_fichier}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {lectureId === e.id && e.url_lecture && (
                  <div className="mt-3">
                    <AudioPlayer
                      src={e.url_lecture}
                      downloadName={e.nom_fichier}
                      durationHint={e.duree_secondes ?? undefined}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="archives-texte-title">
        <h3 id="archives-texte-title" className="flex items-center gap-2 text-base font-semibold text-text">
          <FileText className="h-4 w-4 text-ogefrem-blue" aria-hidden />
          Fichiers texte (transcription)
        </h3>
        {texteQuery.isError ? (
          <p className="text-sm text-danger" role="alert">
            {texteQuery.error instanceof Error
              ? texteQuery.error.message
              : 'Erreur transcriptions.'}
          </p>
        ) : textes.length === 0 ? (
          <p className="text-sm text-text-muted">
            Aucune transcription sauvegardée. En mode live, utilisez « Sauver texte ».
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-sm">
            {textes.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      Transcription · {(t.langue || 'fr').toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatDateHeure(t.cree_le)} · {t.statut}
                      {t.texte_complet
                        ? ` · ${t.texte_complet.split(/\s+/).length} mots`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setTexteOuvertId(texteOuvertId === t.id ? null : t.id)
                      }
                    >
                      {texteOuvertId === t.id ? 'Masquer' : 'Lire'}
                    </Button>
                    {t.texte_complet && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          telechargerTexte(
                            `transcription-${t.langue}-${t.id.slice(0, 8)}.txt`,
                            t.texte_complet!,
                          )
                        }
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        .txt
                      </Button>
                    )}
                  </div>
                </div>
                {texteOuvertId === t.id && t.texte_complet && (
                  <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-4 text-sm leading-relaxed text-text">
                    {t.texte_complet}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {aSupprimer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !deleteMut.isPending && setASupprimer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-audio"
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="confirm-delete-audio" className="text-lg font-bold text-text">
              Supprimer cet enregistrement ?
            </h2>
            <p className="mt-2 text-sm text-text-muted">{aSupprimer.nom_fichier}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setASupprimer(null)} disabled={deleteMut.isPending}>
                Annuler
              </Button>
              <Button
                variant="secondary"
                className="!bg-danger !text-white hover:!bg-danger/90"
                loading={deleteMut.isPending}
                onClick={() => deleteMut.mutate(aSupprimer.id)}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
