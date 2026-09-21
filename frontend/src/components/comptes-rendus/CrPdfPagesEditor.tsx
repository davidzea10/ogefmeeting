import { Button } from '@/components/ui/Button';
import { Download, Trash2, Undo2, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type CrPdfPagesEditorProps = {
  open: boolean;
  blob: Blob;
  filename: string;
  onClose: () => void;
  onAnnounce?: (message: string) => void;
};

type PagePreview = {
  pageIndex: number;
  dataUrl: string;
};

/** Copie indépendante — pdf.js peut transférer / détacher l’ArrayBuffer source. */
function clonerOctets(source: Uint8Array): Uint8Array {
  const copie = new Uint8Array(source.byteLength);
  copie.set(source);
  return copie;
}

async function blobVersUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

async function rendrePreviews(bytes: Uint8Array): Promise<PagePreview[]> {
  // Toujours passer une copie : getDocument peut détacher le buffer.
  const loading = getDocument({ data: clonerOctets(bytes) });
  const pdf = await loading.promise;
  const previews: PagePreview[] = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cibleLargeur = 420;

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = cibleLargeur / unscaled.width;
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D indisponible.');
      await page.render({
        canvasContext: ctx,
        viewport,
        background: '#ffffff',
      }).promise;
      previews.push({
        pageIndex: pageNum - 1,
        dataUrl: canvas.toDataURL('image/jpeg', 0.82),
      });
    }
  } finally {
    // pdf.js v4+ : destroy sur le LoadingTask, pas sur le PDFDocumentProxy
    void loading.destroy();
  }

  return previews;
}

async function reconstruirePdf(
  bytes: Uint8Array,
  pagesAGarder: number[],
): Promise<Uint8Array> {
  const source = await PDFDocument.load(clonerOctets(bytes));
  const cible = await PDFDocument.create();
  const copies = await cible.copyPages(source, pagesAGarder);
  for (const page of copies) {
    cible.addPage(page);
  }
  const saved = await cible.save();
  return clonerOctets(saved);
}

function octetsVersBlob(bytes: Uint8Array): Blob {
  // Copie sur ArrayBuffer classique — évite les vues détachées / SharedArrayBuffer
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: 'application/pdf' });
}

function telechargerBytes(bytes: Uint8Array, filename: string) {
  const fileBlob = octetsVersBlob(bytes);
  if (fileBlob.size === 0) {
    throw new Error('PDF vide — téléchargement impossible.');
  }
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'compte-rendu.pdf';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Ne pas révoquer immédiatement : sinon Chrome affiche « Échec du téléchargement »
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2500);
}

/**
 * Aperçu page à page du PDF CR : suppression de pages avant téléchargement.
 */
export function CrPdfPagesEditor({
  open,
  blob,
  filename,
  onClose,
  onAnnounce,
}: CrPdfPagesEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [previews, setPreviews] = useState<PagePreview[]>([]);
  /** Indices de pages (0-based) marquées pour suppression. */
  const [supprimees, setSupprimees] = useState<Set<number>>(new Set());
  const [telechargement, setTelechargement] = useState(false);
  const generationRef = useRef(0);
  /** Copie stable hors state React (évite perte / détachement). */
  const bytesRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!open) return;
    const gen = ++generationRef.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setSupprimees(new Set());
      setPreviews([]);
      bytesRef.current = null;
      setBytes(null);
      try {
        const data = await blobVersUint8Array(blob);
        if (cancelled || gen !== generationRef.current) return;
        // Conserver une copie dédiée au téléchargement / reconstruction
        const conserves = clonerOctets(data);
        bytesRef.current = conserves;
        setBytes(conserves);
        const pages = await rendrePreviews(conserves);
        if (cancelled || gen !== generationRef.current) return;
        setPreviews(pages);
      } catch (e) {
        if (cancelled || gen !== generationRef.current) return;
        setError(
          e instanceof Error ? e.message : 'Impossible de lire le PDF.',
        );
      } finally {
        if (!cancelled && gen === generationRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, blob]);

  const pagesVisibles = useMemo(
    () => previews.filter((p) => !supprimees.has(p.pageIndex)),
    [previews, supprimees],
  );

  const nbSupprimees = supprimees.size;
  const nbRestantes = previews.length - nbSupprimees;

  function supprimerPage(pageIndex: number) {
    setSupprimees((prev) => {
      const next = new Set(prev);
      next.add(pageIndex);
      return next;
    });
  }

  function restaurerPage(pageIndex: number) {
    setSupprimees((prev) => {
      const next = new Set(prev);
      next.delete(pageIndex);
      return next;
    });
  }

  async function telecharger() {
    const source = bytesRef.current ?? bytes;
    if (!source || source.byteLength === 0) {
      onAnnounce?.('PDF introuvable — rouvrez l’aperçu.');
      return;
    }
    if (nbRestantes <= 0) {
      onAnnounce?.('Conservez au moins une page.');
      return;
    }
    setTelechargement(true);
    try {
      const aGarder = previews
        .map((p) => p.pageIndex)
        .filter((i) => !supprimees.has(i));
      const finalBytes =
        aGarder.length === previews.length
          ? clonerOctets(source)
          : await reconstruirePdf(source, aGarder);
      telechargerBytes(finalBytes, filename);
      onAnnounce?.(
        nbSupprimees > 0
          ? `PDF téléchargé (${nbRestantes} page${nbRestantes > 1 ? 's' : ''}, ${nbSupprimees} retirée${nbSupprimees > 1 ? 's' : ''}).`
          : 'PDF téléchargé.',
      );
      // Laisser le temps au navigateur de démarrer le téléchargement avant de fermer
      window.setTimeout(() => onClose(), 400);
    } catch (e) {
      console.error('Téléchargement PDF CR', e);
      onAnnounce?.(
        e instanceof Error
          ? e.message
          : 'Échec de la reconstruction du PDF.',
      );
    } finally {
      setTelechargement(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cr-pdf-pages-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2
              id="cr-pdf-pages-title"
              className="text-base font-semibold text-text"
            >
              Aperçu PDF — pages
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {loading
                ? 'Chargement des pages…'
                : `${nbRestantes} page${nbRestantes > 1 ? 's' : ''} conservée${nbRestantes > 1 ? 's' : ''}${
                    nbSupprimees > 0
                      ? ` · ${nbSupprimees} à retirer`
                      : ''
                  }`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <p className="text-sm text-text-muted">Rendu des pages en cours…</p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && (
            <ul className="space-y-4">
              {previews.map((p, affichage) => {
                const retiree = supprimees.has(p.pageIndex);
                const numeroAffiche = retiree
                  ? null
                  : pagesVisibles.findIndex(
                      (v) => v.pageIndex === p.pageIndex,
                    ) + 1;
                return (
                  <li
                    key={p.pageIndex}
                    className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-start ${
                      retiree
                        ? 'border-danger/30 bg-danger/5 opacity-60'
                        : 'border-border bg-surface-muted/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        {retiree
                          ? `Page ${affichage + 1} (supprimée)`
                          : `Page ${numeroAffiche}`}
                      </p>
                      <img
                        src={p.dataUrl}
                        alt={`Page ${affichage + 1} du compte rendu`}
                        className="max-h-[70vh] w-full rounded-lg border border-border bg-white object-contain shadow-sm"
                      />
                    </div>
                    <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                      {retiree ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => restaurerPage(p.pageIndex)}
                        >
                          <Undo2 className="h-4 w-4" aria-hidden />
                          Restaurer
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-danger hover:bg-danger/10"
                          onClick={() => supprimerPage(p.pageIndex)}
                          disabled={nbRestantes <= 1}
                          title={
                            nbRestantes <= 1
                              ? 'Au moins une page doit rester'
                              : 'Retirer cette page du PDF'
                          }
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Supprimer la page
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            loading={telechargement}
            disabled={loading || !!error || nbRestantes <= 0}
            onClick={() => void telecharger()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Télécharger le PDF
            {nbSupprimees > 0 ? ` (${nbRestantes} p.)` : ''}
          </Button>
        </footer>
      </div>
    </div>
  );
}
