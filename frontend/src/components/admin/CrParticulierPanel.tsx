import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import {
  genererCrParticulier,
  obtenirMetaCrParticulier,
  telechargerPdfCrParticulier,
  type CrParticulierPreview,
} from '@/lib/admin-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileText, Sparkles } from 'lucide-react';
import { useState } from 'react';

const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * CR particulier admin — réunion DANTIC / PADS / SYGREM avec STT de test.
 * Rendu d’aperçu aligné sur le CR normal (Introduction / ODJ romains / Conclusion).
 */
export function CrParticulierPanel() {
  const announce = useAnnouncerStore((s) => s.announce);
  const [preview, setPreview] = useState<CrParticulierPreview | null>(null);

  const metaQuery = useQuery({
    queryKey: ['admin', 'cr-particulier'],
    queryFn: obtenirMetaCrParticulier,
  });

  const genererMut = useMutation({
    mutationFn: genererCrParticulier,
    onSuccess: (data) => {
      setPreview(data);
      const total = data.stats?.mots_total;
      announce(
        total
          ? `CR particulier généré (${total.toLocaleString('fr-FR')} mots).`
          : 'CR particulier généré (très détaillé).',
      );
    },
    onError: (e: Error) => announce(e.message),
  });

  const pdfMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('Générez d’abord le compte rendu.');
      return telechargerPdfCrParticulier({
        contenu: preview.contenu,
        contenu_html: preview.contenu_html,
      });
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cr-particulier-pads-sygren.pdf';
      a.click();
      URL.revokeObjectURL(url);
      announce('PDF téléchargé.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const meta = metaQuery.data;
  const stats = preview?.stats;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-text">
          <FileText className="h-5 w-5 text-ogefrem-blue" aria-hidden />
          CR particulier — PADS / SYGREM
        </h3>
        <p className="mt-2 text-sm text-text-muted">
          Réunion DANTIC (OGEFREM) avec le partenaire PADS sur l’infrastructure
          applicative SYGREM. Génération <strong>très détaillée</strong> : un
          passage GPT par grand point (I. Objectifs…), minimum 150 mots par
          sous-point, rendu identique au compte rendu normal.
        </p>

        {metaQuery.isLoading && (
          <p className="mt-4 text-sm text-text-muted">Chargement des métadonnées…</p>
        )}
        {metaQuery.isError && (
          <p className="mt-4 text-sm text-danger" role="alert">
            Impossible de charger le CR particulier.
          </p>
        )}

        {meta && (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-text-muted">Titre</dt>
              <dd className="mt-0.5 font-medium text-text">{meta.titre}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-text-muted">Directions</dt>
              <dd className="mt-0.5 text-text">{meta.directions_codes.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-text-muted">
                Transcription STT
              </dt>
              <dd className="mt-0.5 text-text">
                ≈ {meta.nb_mots_transcription.toLocaleString('fr-FR')} mots
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-text-muted">Contexte</dt>
              <dd className="mt-0.5 text-text-muted">{meta.description}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-1 text-xs font-semibold uppercase text-text-muted">
                Ordre du jour (chiffres romains)
              </dt>
              <dd>
                <ol className="list-none space-y-0.5 text-text">
                  {meta.points_ordre_jour.map((p, i) => (
                    <li key={p}>
                      <span className="font-semibold text-ogefrem-navy">
                        {ROMAINS[i] ?? i + 1}.
                      </span>{' '}
                      {p}
                    </li>
                  ))}
                </ol>
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            loading={genererMut.isPending}
            onClick={() => genererMut.mutate()}
            disabled={!meta}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Générer le CR très détaillé
          </Button>
          <Button
            variant="secondary"
            loading={pdfMut.isPending}
            disabled={!preview}
            onClick={() => pdfMut.mutate()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Télécharger le PDF
          </Button>
        </div>
        {genererMut.isPending && (
          <p className="mt-3 text-sm text-ogefrem-blue">
            Génération multi-passes en cours (7 grands points + enrichissement) —
            comptez 4 à 8 minutes…
          </p>
        )}
      </section>

      {preview && (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h4 className="text-base font-semibold text-text">Aperçu du compte rendu</h4>
          <p className="mt-1 text-xs text-text-muted">
            Niveau : très détaillé · Transcription :{' '}
            {preview.nb_mots_transcription.toLocaleString('fr-FR')} mots
            {stats
              ? ` · CR généré : ${stats.mots_total.toLocaleString('fr-FR')} mots`
              : null}
          </p>

          {stats && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
              <p className="mb-2 font-semibold text-text">
                Volume par section (cible ≥ 150 mots / sous-point)
              </p>
              <ul className="space-y-1 text-text-muted">
                <li>
                  Introduction : {stats.mots_introduction} mots · Conclusion :{' '}
                  {stats.mots_conclusion} mots
                </li>
                {stats.points.map((p) => (
                  <li key={p.romain + p.titre}>
                    <span className="font-medium text-text">
                      {p.romain}. {p.titre}
                    </span>{' '}
                    (intro {p.mots_contenu} mots)
                    {p.sous_points.length > 0 && (
                      <span>
                        {' '}
                        — sous-points :{' '}
                        {p.sous_points
                          .map((sp) => `${sp.mots}${sp.mots < 150 ? ' ⚠' : ''}`)
                          .join(', ')}{' '}
                        mots
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            className="prose prose-sm mt-4 max-w-none text-text
              [&_h2]:mt-8 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ogefrem-navy
              [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ogefrem-blue
              [&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-ogefrem-navy
              [&_p]:my-2 [&_p]:text-justify [&_p]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: preview.contenu_html }}
          />
        </section>
      )}
    </div>
  );
}
