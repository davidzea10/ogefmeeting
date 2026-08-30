import { Button } from '@/components/ui/Button';
import { gererOrdreJour, modifierPointOrdreJour } from '@/lib/reunions-api';
import type { PointOrdreJour } from '@ogefmeeting/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

type Props = {
  reunionId: string;
  points: PointOrdreJour[];
  peutModifier: boolean;
  onInvalidate: () => Promise<void>;
  announce: (message: string) => void;
};

type PointDraft = {
  titre: string;
  description: string;
  duree_minutes: string;
};

const emptyDraft = (): PointDraft => ({ titre: '', description: '', duree_minutes: '' });

function toPayload(points: PointOrdreJour[]) {
  return points.map((point, index) => ({
    id: point.id,
    titre: point.titre,
    description: point.description,
    ordre: index,
    duree_minutes: point.duree_minutes,
    est_traite: point.est_traite,
  }));
}

function liveInputClass(hasError?: boolean) {
  return `w-full rounded-lg border bg-ogefrem-navy px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-ogefrem-yellow/50 ${
    hasError ? 'border-danger' : 'border-white/20'
  }`;
}

export function LiveOrdreJourPanel({
  reunionId,
  points,
  peutModifier,
  onInvalidate,
  announce,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<PointDraft>(emptyDraft);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PointDraft>(emptyDraft);
  const [editError, setEditError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: (nextPoints: PointOrdreJour[]) =>
      gererOrdreJour(reunionId, toPayload(nextPoints)),
    onSuccess: async () => {
      await onInvalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ pointId, est_traite }: { pointId: string; est_traite: boolean }) =>
      modifierPointOrdreJour(reunionId, pointId, est_traite),
    onSuccess: async (_, vars) => {
      announce(vars.est_traite ? 'Point traité.' : 'Point rouvert.');
      await onInvalidate();
    },
    onError: (e: Error) => announce(e.message),
  });

  const pending = saveMut.isPending || toggleMut.isPending;

  function parseDraft(draft: PointDraft) {
    const titre = draft.titre.trim();
    if (titre.length < 2) {
      return { error: 'Le titre doit contenir au moins 2 caractères.' as const };
    }
    const dureeRaw = draft.duree_minutes.trim();
    let duree_minutes: number | null = null;
    if (dureeRaw) {
      const parsed = Number(dureeRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return { error: 'La durée doit être un entier positif (minutes).' as const };
      }
      duree_minutes = parsed;
    }
    return {
      point: {
        titre,
        description: draft.description.trim() || null,
        duree_minutes,
      },
    };
  }

  async function persist(nextPoints: PointOrdreJour[], message: string) {
    await saveMut.mutateAsync(nextPoints);
    announce(message);
    setShowAdd(false);
    setAddDraft(emptyDraft());
    setAddError(null);
    setEditingId(null);
    setEditDraft(emptyDraft());
    setEditError(null);
  }

  async function handleAdd() {
    const parsed = parseDraft(addDraft);
    if ('error' in parsed) {
      setAddError(parsed.error ?? null);
      return;
    }
    const next: PointOrdreJour[] = [
      ...points,
      {
        id: crypto.randomUUID(),
        reunion_id: reunionId,
        titre: parsed.point.titre,
        description: parsed.point.description,
        ordre: points.length,
        est_traite: false,
        duree_minutes: parsed.point.duree_minutes,
        cree_le: new Date().toISOString(),
        modifie_le: new Date().toISOString(),
      },
    ];
    await persist(next, 'Point ajouté à l’ordre du jour.');
  }

  function startEdit(point: PointOrdreJour) {
    setEditingId(point.id);
    setEditDraft({
      titre: point.titre,
      description: point.description ?? '',
      duree_minutes: point.duree_minutes ? String(point.duree_minutes) : '',
    });
    setEditError(null);
  }

  async function handleSaveEdit(pointId: string) {
    const current = points.find((p) => p.id === pointId);
    if (!current) return;
    const parsed = parseDraft(editDraft);
    if ('error' in parsed) {
      setEditError(parsed.error ?? null);
      return;
    }
    const next = points.map((p) =>
      p.id === pointId
        ? {
            ...p,
            titre: parsed.point.titre,
            description: parsed.point.description,
            duree_minutes: parsed.point.duree_minutes,
          }
        : p,
    );
    await persist(next, 'Point modifié.');
  }

  async function handleDelete(pointId: string) {
    const next = points.filter((p) => p.id !== pointId);
    await persist(next, 'Point supprimé de l’ordre du jour.');
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= points.length) return;
    const next = [...points];
    [next[index], next[target]] = [next[target], next[index]];
    await persist(next, 'Ordre du jour réorganisé.');
  }

  return (
    <section aria-labelledby="live-odj-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-odj-title" className="flex items-center gap-2 text-lg font-semibold">
          <CheckSquare className="h-5 w-5 text-ogefrem-yellow" aria-hidden />
          Ordre du jour
        </h2>
        {peutModifier && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setShowAdd((v) => !v);
              setAddError(null);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {showAdd ? 'Fermer' : 'Ajouter un point'}
          </Button>
        )}
      </div>

      {peutModifier && showAdd && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white/90">Nouveau point</h3>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-white/70">Titre *</span>
            <input
              className={liveInputClass(Boolean(addError))}
              value={addDraft.titre}
              disabled={pending}
              onChange={(e) => setAddDraft((d) => ({ ...d, titre: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-white/70">Description</span>
            <textarea
              className={`${liveInputClass()} min-h-[72px] resize-y`}
              value={addDraft.description}
              disabled={pending}
              onChange={(e) => setAddDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-white/70">Durée (minutes)</span>
            <input
              type="number"
              min={1}
              className={liveInputClass()}
              value={addDraft.duree_minutes}
              disabled={pending}
              onChange={(e) => setAddDraft((d) => ({ ...d, duree_minutes: e.target.value }))}
            />
          </label>
          {addError && (
            <p className="text-sm text-danger" role="alert">
              {addError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" loading={saveMut.isPending} onClick={handleAdd}>
              Enregistrer le point
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setShowAdd(false);
                setAddDraft(emptyDraft());
                setAddError(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {points.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/20 p-8 text-center text-white/60">
          Aucun point à l’ordre du jour.
          {peutModifier ? ' Utilisez « Ajouter un point » pour en créer un.' : ''}
        </p>
      ) : (
        <ul className="space-y-2">
          {points.map((point, index) => {
            const isEditing = editingId === point.id;

            if (isEditing && peutModifier) {
              return (
                <li
                  key={point.id}
                  className="rounded-xl border border-ogefrem-yellow/40 bg-white/10 p-4 space-y-3"
                >
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-white/70">Titre *</span>
                    <input
                      className={liveInputClass(Boolean(editError))}
                      value={editDraft.titre}
                      disabled={pending}
                      onChange={(e) => setEditDraft((d) => ({ ...d, titre: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-white/70">Description</span>
                    <textarea
                      className={`${liveInputClass()} min-h-[72px] resize-y`}
                      value={editDraft.description}
                      disabled={pending}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, description: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-white/70">Durée (minutes)</span>
                    <input
                      type="number"
                      min={1}
                      className={liveInputClass()}
                      value={editDraft.duree_minutes}
                      disabled={pending}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, duree_minutes: e.target.value }))
                      }
                    />
                  </label>
                  {editError && (
                    <p className="text-sm text-danger" role="alert">
                      {editError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={saveMut.isPending}
                      onClick={() => handleSaveEdit(point.id)}
                    >
                      Enregistrer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(emptyDraft());
                        setEditError(null);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Annuler
                    </Button>
                  </div>
                </li>
              );
            }

            return (
              <li key={point.id}>
                <div
                  className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                    point.est_traite
                      ? 'border-success/40 bg-success/15'
                      : 'border-white/15 bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-ogefrem-yellow disabled:opacity-40"
                    checked={point.est_traite}
                    disabled={!peutModifier || pending}
                    aria-label={`Marquer « ${point.titre} » comme traité`}
                    onChange={(e) =>
                      toggleMut.mutate({ pointId: point.id, est_traite: e.target.checked })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${
                        point.est_traite ? 'text-white/50 line-through' : 'text-white'
                      }`}
                    >
                      <span className="mr-2 text-xs font-bold text-ogefrem-yellow">
                        {index + 1}.
                      </span>
                      {point.titre}
                    </p>
                    {point.description && (
                      <p className="mt-1 text-sm text-white/70">{point.description}</p>
                    )}
                    {point.duree_minutes != null && (
                      <span className="mt-1 block text-xs text-white/40">
                        {point.duree_minutes} min prévues
                      </span>
                    )}
                  </div>
                  {peutModifier && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Monter « ${point.titre} »`}
                        disabled={pending || index === 0}
                        onClick={() => handleMove(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Descendre « ${point.titre} »`}
                        disabled={pending || index === points.length - 1}
                        onClick={() => handleMove(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Modifier « ${point.titre} »`}
                        disabled={pending}
                        onClick={() => startEdit(point)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Supprimer « ${point.titre} »`}
                        disabled={pending}
                        onClick={() => handleDelete(point.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
