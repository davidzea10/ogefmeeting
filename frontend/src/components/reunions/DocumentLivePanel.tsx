import { Button } from '@/components/ui/Button';
import { useDocumentLiveViewer } from '@/hooks/useDocumentLiveViewer';
import { ensureFreshToken } from '@/lib/auth-api';
import {
  listerDocumentsReunion,
  presenterDocument,
  supprimerDocument,
  synchroniserDocumentLive,
  televerserDocument,
  urlFichierDocument,
} from '@/lib/documents-api';
import { useAuthStore } from '@/stores/auth.store';
import type { DocumentLiveEtat, DocumentReunionAvecUrl } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Maximize2,
  Minimize2,
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
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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

async function chargerPdfBytes(
  documentId: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const token =
    (await ensureFreshToken()) ?? useAuthStore.getState().accessToken ?? null;
  const res = await fetch(urlFichierDocument(documentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok) {
    throw new Error(`Impossible de charger le PDF (HTTP ${res.status}).`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function rendrePdfDansConteneur(
  documentId: string,
  container: HTMLDivElement,
  signal: AbortSignal,
): Promise<number> {
  container.replaceChildren();

  const bytes = await chargerPdfBytes(documentId, signal);
  if (signal.aborted) return 0;

  const loading = getDocument({ data: bytes });
  const pdf = await loading.promise;
  if (signal.aborted) {
    await pdf.destroy().catch(() => undefined);
    return 0;
  }

  // Attendre le layout pour une largeur fiable
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const largeurCss = Math.max(
    280,
    Math.min(container.clientWidth || 640, 1100),
  );
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (signal.aborted) break;
    const page = await pdf.getPage(pageNum);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = largeurCss / unscaled.width;
    const viewport = page.getViewport({ scale: scale * dpr });

    const wrap = document.createElement('div');
    wrap.dataset.page = String(pageNum);
    wrap.className = 'mb-3 overflow-hidden rounded-lg border border-white/15 bg-white';

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    canvas.className = 'block max-w-full bg-white';
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const task = page.render({
      canvas,
      viewport,
      background: '#ffffff',
    });

    const onAbort = () => {
      try {
        task.cancel();
      } catch {
        /* ignore */
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      await task.promise;
    } catch (e: unknown) {
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
      if (name === 'RenderingCancelledException' || signal.aborted) {
        break;
      }
      throw e;
    } finally {
      signal.removeEventListener('abort', onAbort);
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
  /** document_id déjà rendu (évite rechargements inutiles). */
  const pdfChargePourRef = useRef<string | null>(null);

  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nbPages, setNbPages] = useState(0);
  const [pageLocale, setPageLocale] = useState(1);
  const [renduErreur, setRenduErreur] = useState<string | null>(null);
  const [chargementPdf, setChargementPdf] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);

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
      // Force un nouveau rendu si on change de document (ou stop)
      if (data.document_id !== pdfChargePourRef.current) {
        pdfChargePourRef.current = null;
      }
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
          .then((data) => {
            setEtatLocal({
              ...data,
              url_lecture: undefined,
            });
          })
          .catch(() => undefined);
      }, 180);
    },
    [etat.document_id, peutControle, reunionId, setEtatLocal],
  );

  // Rendu PDF une fois par document_id (via proxy API authentifié)
  useEffect(() => {
    const documentId = etat.document_id;
    const presentable = etat.presentable !== false && Boolean(documentId);

    if (!documentId || !presentable) {
      pdfChargePourRef.current = null;
      pagesRef.current?.replaceChildren();
      setNbPages(0);
      setRenduErreur(null);
      setChargementPdf(false);
      return;
    }

    if (pdfChargePourRef.current === documentId && nbPages > 0) {
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    const demarrer = async () => {
      // Laisse React monter le conteneur (pagesRef)
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const container = pagesRef.current;
      if (!container || cancelled) return;

      pdfChargePourRef.current = documentId;
      setChargementPdf(true);
      setRenduErreur(null);

      try {
        const n = await rendrePdfDansConteneur(documentId, container, ac.signal);
        if (!cancelled && !ac.signal.aborted) {
          setNbPages(n);
          if (n < 1) {
            setRenduErreur('Le PDF ne contient aucune page affichable.');
          }
        }
      } catch (e: unknown) {
        if (!cancelled && !ac.signal.aborted) {
          pdfChargePourRef.current = null;
          setNbPages(0);
          setRenduErreur(
            e instanceof Error ? e.message : 'Impossible d’afficher le PDF.',
          );
        }
      } finally {
        if (!cancelled) setChargementPdf(false);
      }
    };

    void demarrer();

    return () => {
      cancelled = true;
      ac.abort();
    };
    // nbPages volontairement hors deps : sert seulement de garde anti-rechargement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat.document_id, etat.presentable]);

  // Scroll distant : participants seulement (pas l’orga qui pilote)
  useEffect(() => {
    if (peutControle) {
      setPageLocale(etat.page ?? 1);
      return;
    }
    const el = scrollRef.current;
    if (!el || !etat.document_id || nbPages < 1) return;

    applyingRemoteRef.current = true;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    el.scrollTop = (etat.scroll_ratio ?? 0) * max;
    setPageLocale(etat.page ?? 1);
    const t = window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 100);
    return () => window.clearTimeout(t);
  }, [peutControle, etat.document_id, etat.page, etat.scroll_ratio, nbPages]);

  // Escape quitte le plein écran
  useEffect(() => {
    if (!pleinEcran) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPleinEcran(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pleinEcran]);

  function onScrollLocal() {
    if (!peutControle || applyingRemoteRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const scrollRatio = Math.min(1, Math.max(0, el.scrollTop / max));

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
    <>
      <section className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-lg">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
            Document partagé
          </h2>
          <div className="flex items-center gap-2">
            {etat.document_id && (
              <span className="rounded-full bg-ogefrem-yellow/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ogefrem-navy">
                En présentation
              </span>
            )}
            {etat.document_id && !pleinEcran && (
              <Button
                size="sm"
                variant="secondary"
                className="!bg-white/15 !text-white hover:!bg-white/25"
                onClick={() => setPleinEcran(true)}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
                Agrandir
              </Button>
            )}
          </div>
        </div>

        <p className="mb-3 text-xs text-white/55">
          PDF : suivi synchronisé (scroll / pages). Word : dépôt et téléchargement —
          convertissez en PDF pour présenter.
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

        {!etat.document_id && (
          <p className="rounded-xl border border-dashed border-white/20 px-3 py-8 text-center text-sm text-white/45">
            {peutControle
              ? 'Aucun document en présentation. Ajoutez un PDF puis cliquez sur l’œil.'
              : 'En attente d’un document présenté par l’organisateur…'}
          </p>
        )}

        {etat.document_id && pleinEcran && (
          <p className="rounded-xl border border-white/15 bg-black/20 px-3 py-6 text-center text-sm text-white/50">
            Document affiché en plein écran — cliquez sur « Réduire » pour revenir ici.
          </p>
        )}

        {/* Même nœud DOM en taille normale ou plein écran → pas de rechargement PDF */}
        {etat.document_id && (
          <div
            className={
              pleinEcran
                ? 'fixed inset-0 z-[60] flex flex-col bg-ogefrem-navy/98 p-4 sm:p-6'
                : 'mt-3 space-y-2'
            }
            role={pleinEcran ? 'dialog' : undefined}
            aria-modal={pleinEcran ? true : undefined}
            aria-label={pleinEcran ? 'Document partagé en plein écran' : undefined}
          >
            <div
              className={
                pleinEcran
                  ? 'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 overflow-hidden'
                  : 'space-y-2'
              }
            >
              {pleinEcran && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <FileText className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
                    Document partagé
                  </h2>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!bg-ogefrem-yellow !text-ogefrem-navy hover:!bg-ogefrem-yellow/90"
                    onClick={() => setPleinEcran(false)}
                  >
                    <Minimize2 className="h-4 w-4" aria-hidden />
                    Réduire
                  </Button>
                </div>
              )}

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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-white hover:!bg-white/10"
                    onClick={() => setPleinEcran((v) => !v)}
                    aria-label={
                      pleinEcran ? 'Réduire le document' : 'Agrandir le document'
                    }
                    title={pleinEcran ? 'Réduire' : 'Plein écran'}
                  >
                    {pleinEcran ? (
                      <Minimize2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <Maximize2 className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>

              {renduErreur && (
                <p className="text-sm text-amber-200/90" role="alert">
                  {renduErreur}
                </p>
              )}
              {chargementPdf && nbPages < 1 && !renduErreur && (
                <p className="text-sm text-white/60">Chargement du PDF…</p>
              )}
              <div
                ref={scrollRef}
                onScroll={onScrollLocal}
                className={
                  pleinEcran
                    ? 'max-h-[calc(100vh-6rem)] flex-1 overflow-y-auto rounded-xl border border-white/10 bg-zinc-100 p-3'
                    : 'max-h-[min(28rem,50vh)] overflow-y-auto rounded-xl border border-white/10 bg-zinc-100 p-2'
                }
                aria-label="Visionneuse PDF synchronisée"
              >
                <div ref={pagesRef} />
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export type { DocumentLiveEtat };
