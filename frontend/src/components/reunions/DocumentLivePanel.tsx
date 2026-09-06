import { Button } from '@/components/ui/Button';
import { useDocumentLiveViewer } from '@/hooks/useDocumentLiveViewer';
import {
  listerDocumentsReunion,
  presenterDocument,
  supprimerDocument,
  synchroniserDocumentLive,
  televerserDocument,
} from '@/lib/documents-api';
import type { DocumentLiveEtat, DocumentReunionAvecUrl } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Props = {
  reunionId: string;
  peutControle: boolean;
  enLive: boolean;
};

function formatTaille(octets: number | null): string {
  if (octets == null) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

async function rendrePdfDansConteneur(
  url: string,
  container: HTMLDivElement,
  signal: AbortSignal,
): Promise<number> {
  container.replaceChildren();
  const loading = pdfjs.getDocument({ url, withCredentials: false });
  const pdf = await loading.promise;
  if (signal.aborted) {
    return 0;
  }

  const largeur = Math.min(container.clientWidth || 640, 900);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (signal.aborted) break;
    const page = await pdf.getPage(pageNum);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = largeur / unscaled.width;
    const viewport = page.getViewport({ scale });

    const wrap = document.createElement('div');
    wrap.dataset.page = String(pageNum);
    wrap.className = 'mb-3 overflow-hidden rounded-lg border border-white/15 bg-white';

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'block h-auto w-full';
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
  }

  return pdf.numPages;
}

/**
 * Partage de documents en live : upload PDF/Word, présentation PDF sync (page + scroll).
 */
export function DocumentLivePanel({ reunionId, peutControle, enLive }: Props) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const applyingRemoteRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nbPages, setNbPages] = useState(0);
  const [pageLocale, setPageLocale] = useState(1);
  const [renduErreur, setRenduErreur] = useState<string | null>(null);

  const { etat, setEtatLocal } = useDocumentLiveViewer(reunionId, enLive);

  const docsQuery = useQuery({
    queryKey: ['documents', reunionId],
    queryFn: () => listerDocumentsReunion(reunionId),
    enabled: Boolean(reunionId) && enLive,
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      televerserDocument({
        reunionId,
        file,
        onProgress: setProgress,
      }),
    onSuccess: async (doc) => {
      setProgress(null);
      setMessage(
        doc.presentable
          ? 'PDF téléversé. Cliquez sur « Présenter » pour le partager.'
          : 'Word téléversé. Pour le suivi synchronisé, convertissez-le en PDF.',
      );
      await queryClient.invalidateQueries({ queryKey: ['documents', reunionId] });
    },
    onError: (e: Error) => {
      setProgress(null);
      setMessage(e.message);
    },
  });

  const presenterMut = useMutation({
    mutationFn: (documentId: string | null) =>
      presenterDocument(reunionId, documentId),
    onSuccess: (data) => {
      setEtatLocal(data);
      setMessage(
        data.document_id
          ? 'Document présenté — les participants suivent votre scroll.'
          : 'Présentation arrêtée.',
      );
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => supprimerDocument(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', reunionId] });
      setMessage('Document supprimé.');
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const publierScroll = useCallback(
    (next: { page: number; scrollRatio: number }) => {
      if (!peutControle || !etat.document_id) return;
      if (syncTimerRef.current != null) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => {
        void synchroniserDocumentLive({
          reunionId,
          documentId: etat.document_id,
          page: next.page,
          scrollRatio: next.scrollRatio,
        })
          .then((data) => setEtatLocal(data))
          .catch(() => undefined);
      }, 120);
    },
    [etat.document_id, peutControle, reunionId, setEtatLocal],
  );

  // Rendu PDF quand un document est présenté
  useEffect(() => {
    const url = etat.url_lecture;
    const container = pagesRef.current;
    if (!url || !container || !etat.presentable) {
      if (container) container.replaceChildren();
      setNbPages(0);
      setRenduErreur(null);
      return;
    }

    const ac = new AbortController();
    setRenduErreur(null);
    void rendrePdfDansConteneur(url, container, ac.signal)
      .then((n) => {
        if (!ac.signal.aborted) setNbPages(n);
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) {
          setRenduErreur(
            e instanceof Error ? e.message : 'Impossible d’afficher le PDF.',
          );
        }
      });

    return () => ac.abort();
  }, [etat.url_lecture, etat.document_id, etat.presentable]);

  // Appliquer scroll distant (participants) ou après rendu
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !etat.document_id) return;
    applyingRemoteRef.current = true;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    el.scrollTop = (etat.scroll_ratio ?? 0) * max;
    setPageLocale(etat.page ?? 1);
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 80);
  }, [etat.document_id, etat.page, etat.scroll_ratio, nbPages]);

  function onScrollLocal() {
    if (!peutControle || applyingRemoteRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const scrollRatio = Math.min(1, Math.max(0, el.scrollTop / max));

    // Page visible ≈ proportionnelle au scroll
    const page =
      nbPages > 0
        ? Math.min(nbPages, Math.max(1, Math.round(scrollRatio * (nbPages - 1)) + 1))
        : 1;
    setPageLocale(page);
    publierScroll({ page, scrollRatio });
  }

  function allerPage(delta: number) {
    if (!peutControle || !etat.document_id || nbPages < 1) return;
    const next = Math.min(nbPages, Math.max(1, pageLocale + delta));
    setPageLocale(next);
    const el = scrollRef.current;
    const target = pagesRef.current?.querySelector(
      `[data-page="${next}"]`,
    ) as HTMLElement | null;
    if (el && target) {
      applyingRemoteRef.current = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        applyingRemoteRef.current = false;
        const max = Math.max(1, el.scrollHeight - el.clientHeight);
        publierScroll({
          page: next,
          scrollRatio: Math.min(1, Math.max(0, el.scrollTop / max)),
        });
      }, 350);
    } else {
      const scrollRatio = nbPages <= 1 ? 0 : (next - 1) / (nbPages - 1);
      publierScroll({ page: next, scrollRatio });
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadMut.mutate(file);
  }

  const docs = docsQuery.data ?? [];
  const docActif = docs.find((d) => d.id === etat.document_id) ?? null;

  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-lg">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
          Document partagé
        </h2>
        {etat.document_id && (
          <span className="rounded-full bg-ogefrem-yellow/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ogefrem-navy">
            En présentation
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-white/55">
        PDF : suivi synchronisé (scroll / pages). Word : dépôt et téléchargement — convertissez
        en PDF pour présenter.
      </p>

      {peutControle && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onFileChange}
          />
          <Button
            size="sm"
            variant="secondary"
            className="!bg-white/15 !text-white hover:!bg-white/25"
            loading={uploadMut.isPending}
            disabled={!enLive}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Ajouter un fichier
          </Button>
          {etat.document_id && (
            <Button
              size="sm"
              variant="secondary"
              className="!bg-white/10 !text-white hover:!bg-white/20"
              loading={presenterMut.isPending}
              onClick={() => presenterMut.mutate(null)}
            >
              <EyeOff className="h-4 w-4" aria-hidden />
              Arrêter la présentation
            </Button>
          )}
        </div>
      )}

      {progress != null && (
        <p className="mb-2 text-xs text-ogefrem-yellow">Upload… {progress} %</p>
      )}
      {message && (
        <p className="mb-2 text-xs text-white/60" role="status">
          {message}
        </p>
      )}

      {docs.length > 0 && (
        <ul className="mb-3 max-h-36 space-y-1.5 overflow-y-auto">
          {docs.map((d: DocumentReunionAvecUrl) => {
            const actif = d.id === etat.document_id;
            return (
              <li
                key={d.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                  actif
                    ? 'border-ogefrem-yellow/50 bg-ogefrem-yellow/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{d.nom_fichier}</p>
                  <p className="text-[11px] text-white/50">
                    {d.presentable ? 'PDF' : 'Word'} · {formatTaille(d.taille_octets)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {d.url_lecture && (
                    <a
                      href={d.url_lecture}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                      aria-label={`Télécharger ${d.nom_fichier}`}
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                  {peutControle && d.presentable && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-ogefrem-yellow hover:bg-ogefrem-yellow/15"
                      title={actif ? 'Déjà présenté' : 'Présenter'}
                      disabled={presenterMut.isPending || actif}
                      onClick={() => presenterMut.mutate(d.id)}
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                  {peutControle && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-white/60 hover:bg-danger/20 hover:text-red-200"
                      title="Supprimer"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${d.nom_fichier} » ?`)) {
                          deleteMut.mutate(d.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!etat.document_id ? (
        <p className="rounded-xl border border-dashed border-white/20 px-3 py-8 text-center text-sm text-white/45">
          {peutControle
            ? 'Aucun document en présentation. Ajoutez un PDF puis cliquez sur l’œil.'
            : 'En attente d’un document présenté par l’organisateur…'}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
            <span className="truncate font-medium text-white">
              {etat.nom_fichier ?? docActif?.nom_fichier ?? 'Document'}
            </span>
            <div className="flex items-center gap-1">
              {peutControle && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-white hover:!bg-white/10"
                    disabled={pageLocale <= 1}
                    onClick={() => allerPage(-1)}
                    aria-label="Page précédente"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <span className="min-w-[4.5rem] text-center tabular-nums">
                    p. {pageLocale}
                    {nbPages > 0 ? ` / ${nbPages}` : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-white hover:!bg-white/10"
                    disabled={nbPages > 0 && pageLocale >= nbPages}
                    onClick={() => allerPage(1)}
                    aria-label="Page suivante"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </>
              )}
              {!peutControle && (
                <span className="tabular-nums">
                  Suivi · p. {etat.page}
                  {nbPages > 0 ? ` / ${nbPages}` : ''}
                </span>
              )}
            </div>
          </div>

          {renduErreur ? (
            <p className="text-sm text-white/55">{renduErreur}</p>
          ) : (
            <div
              ref={scrollRef}
              onScroll={onScrollLocal}
              className="max-h-[min(28rem,50vh)] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2"
              aria-label="Visionneuse PDF synchronisée"
            >
              <div ref={pagesRef} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Export pour tests éventuels */
export type { DocumentLiveEtat };
