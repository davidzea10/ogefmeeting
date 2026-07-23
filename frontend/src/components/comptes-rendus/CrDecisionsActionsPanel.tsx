import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  creerAction,
  creerDecision,
  listerActions,
  listerDecisions,
  modifierAction,
  supprimerAction,
  supprimerDecision,
} from '@/lib/actions-decisions-api';
import { useAuthStore } from '@/stores/auth.store';
import type { PrioriteAction, Profil, RoleUtilisateur, StatutAction } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Gavel, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const LIBELLES_PRIORITE: Record<PrioriteAction, string> = {
  basse: 'Basse',
  moyenne: 'Moyenne',
  haute: 'Haute',
  critique: 'Critique',
};

const LIBELLES_STATUT_ACTION: Record<StatutAction, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
  en_retard: 'En retard',
};

function peutGererDecisions(role: RoleUtilisateur | null): boolean {
  return role === 'administrateur' || role === 'directeur' || role === 'secretaire';
}

function peutGererActions(role: RoleUtilisateur | null): boolean {
  return (
    role === 'administrateur' ||
    role === 'directeur' ||
    role === 'secretaire' ||
    role === 'participant'
  );
}

type Props = {
  reunionId: string;
  compteRenduId: string;
  profils: Profil[];
  /** Si false : lecture seule (ex. CR archivé) */
  editable?: boolean;
};

export function CrDecisionsActionsPanel({
  reunionId,
  compteRenduId,
  profils,
  editable = true,
}: Props) {
  const announce = useAnnouncerStore((s) => s.announce);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const profilId = useAuthStore((s) => s.profil?.id);
  const queryClient = useQueryClient();

  const canDecisions = editable && peutGererDecisions(role);
  const canActions = editable && peutGererActions(role);

  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [decisionTitre, setDecisionTitre] = useState('');
  const [decisionDesc, setDecisionDesc] = useState('');
  const [actionTitre, setActionTitre] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionResponsable, setActionResponsable] = useState('');
  const [actionPriorite, setActionPriorite] = useState<PrioriteAction>('moyenne');
  const [actionEcheance, setActionEcheance] = useState('');
  const [actionDecisionId, setActionDecisionId] = useState('');

  const decisionsQuery = useQuery({
    queryKey: ['decisions', 'cr', compteRenduId],
    queryFn: () =>
      listerDecisions({ compte_rendu_id: compteRenduId, limite: 50 }),
  });

  const actionsQuery = useQuery({
    queryKey: ['actions', 'cr', compteRenduId],
    queryFn: () => listerActions({ compte_rendu_id: compteRenduId, limite: 50 }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['decisions'] });
    await queryClient.invalidateQueries({ queryKey: ['actions'] });
    await queryClient.invalidateQueries({ queryKey: ['actions-reunion', reunionId] });
  };

  const creerDecisionMut = useMutation({
    mutationFn: () =>
      creerDecision({
        reunion_id: reunionId,
        compte_rendu_id: compteRenduId,
        titre: decisionTitre.trim(),
        description: decisionDesc.trim() || null,
        cree_par: profilId ?? null,
        decide_le: new Date().toISOString(),
      }),
    onSuccess: async () => {
      setDecisionTitre('');
      setDecisionDesc('');
      setShowDecisionForm(false);
      await invalidate();
      announce('Décision enregistrée.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const creerActionMut = useMutation({
    mutationFn: () =>
      creerAction({
        reunion_id: reunionId,
        compte_rendu_id: compteRenduId,
        titre: actionTitre.trim(),
        description: actionDesc.trim() || null,
        responsable_id: actionResponsable || null,
        priorite: actionPriorite,
        date_echeance: actionEcheance || null,
        decision_id: actionDecisionId || null,
        cree_par: profilId ?? null,
      }),
    onSuccess: async () => {
      setActionTitre('');
      setActionDesc('');
      setActionResponsable('');
      setActionPriorite('moyenne');
      setActionEcheance('');
      setActionDecisionId('');
      setShowActionForm(false);
      await invalidate();
      announce('Action de suivi créée.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const statutMut = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutAction }) =>
      modifierAction(id, { statut }),
    onSuccess: async () => {
      await invalidate();
      announce('Statut de l’action mis à jour.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const deleteDecisionMut = useMutation({
    mutationFn: (id: string) => supprimerDecision(id),
    onSuccess: async () => {
      await invalidate();
      announce('Décision supprimée.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const deleteActionMut = useMutation({
    mutationFn: (id: string) => supprimerAction(id),
    onSuccess: async () => {
      await invalidate();
      announce('Action supprimée.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const nomProfil = (id: string | null) => {
    if (!id) return 'Non assigné';
    const p = profils.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}` : id.slice(0, 8);
  };

  const decisions = decisionsQuery.data?.items ?? [];
  const actions = actionsQuery.data?.items ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Gavel className="h-4 w-4 text-ogefrem-blue" aria-hidden />
            Décisions & actions de suivi
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Éléments structurés liés à ce compte rendu (visibles aussi dans la réunion).
          </p>
        </div>
        <Link
          to={`/reunions/${reunionId}?tab=actions`}
          className="text-xs font-semibold text-ogefrem-blue hover:underline"
        >
          Voir dans la réunion →
        </Link>
      </div>

      {/* Décisions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-text">Décisions ({decisions.length})</h4>
          {canDecisions && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDecisionForm((v) => !v)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Décision
            </Button>
          )}
        </div>

        {showDecisionForm && (
          <form
            className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (decisionTitre.trim().length < 3) {
                announce('Le titre doit contenir au moins 3 caractères.');
                return;
              }
              creerDecisionMut.mutate();
            }}
          >
            <input
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              placeholder="Titre de la décision *"
              value={decisionTitre}
              onChange={(e) => setDecisionTitre(e.target.value)}
              required
              minLength={3}
            />
            <textarea
              className="min-h-[3rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Description (optionnel)"
              value={decisionDesc}
              onChange={(e) => setDecisionDesc(e.target.value)}
            />
            <Button size="sm" type="submit" loading={creerDecisionMut.isPending}>
              Enregistrer la décision
            </Button>
          </form>
        )}

        {decisionsQuery.isLoading && (
          <p className="text-sm text-text-muted">Chargement…</p>
        )}
        {decisionsQuery.isSuccess && decisions.length === 0 && (
          <p className="text-sm text-text-muted">Aucune décision pour ce CR.</p>
        )}
        {decisions.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {decisions.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-text">{d.titre}</p>
                  {d.description && (
                    <p className="mt-0.5 text-xs text-text-muted">{d.description}</p>
                  )}
                </div>
                {canDecisions && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-danger"
                    aria-label="Supprimer la décision"
                    onClick={() => {
                      if (window.confirm('Supprimer cette décision ?')) {
                        deleteDecisionMut.mutate(d.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-text">
            <CheckSquare className="h-4 w-4 text-ogefrem-blue" aria-hidden />
            Actions ({actions.length})
          </h4>
          {canActions && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowActionForm((v) => !v)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Action
            </Button>
          )}
        </div>

        {showActionForm && (
          <form
            className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (actionTitre.trim().length < 3) {
                announce('Le titre doit contenir au moins 3 caractères.');
                return;
              }
              creerActionMut.mutate();
            }}
          >
            <input
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              placeholder="Titre de l’action *"
              value={actionTitre}
              onChange={(e) => setActionTitre(e.target.value)}
              required
              minLength={3}
            />
            <textarea
              className="min-h-[3rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Description (optionnel)"
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-text-muted">
                Responsable
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
                  value={actionResponsable}
                  onChange={(e) => setActionResponsable(e.target.value)}
                >
                  <option value="">— Non assigné —</option>
                  {profils.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-text-muted">
                Priorité
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
                  value={actionPriorite}
                  onChange={(e) => setActionPriorite(e.target.value as PrioriteAction)}
                >
                  {(Object.keys(LIBELLES_PRIORITE) as PrioriteAction[]).map((k) => (
                    <option key={k} value={k}>
                      {LIBELLES_PRIORITE[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-text-muted">
                Échéance
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
                  value={actionEcheance}
                  onChange={(e) => setActionEcheance(e.target.value)}
                />
              </label>
              <label className="block text-xs text-text-muted">
                Liée à une décision
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
                  value={actionDecisionId}
                  onChange={(e) => setActionDecisionId(e.target.value)}
                >
                  <option value="">— Aucune —</option>
                  {decisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.titre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button size="sm" type="submit" loading={creerActionMut.isPending}>
              Créer l’action
            </Button>
          </form>
        )}

        {actionsQuery.isLoading && (
          <p className="text-sm text-text-muted">Chargement…</p>
        )}
        {actionsQuery.isSuccess && actions.length === 0 && (
          <p className="text-sm text-text-muted">Aucune action pour ce CR.</p>
        )}
        {actions.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {actions.map((a) => (
              <li key={a.id} className="space-y-2 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-text">{a.titre}</p>
                    <p className="text-xs text-text-muted">
                      {nomProfil(a.responsable_id)}
                      {a.date_echeance ? ` · échéance ${a.date_echeance}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge
                      variant={
                        a.priorite === 'critique' || a.priorite === 'haute'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {LIBELLES_PRIORITE[a.priorite]}
                    </Badge>
                    {canActions && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-danger"
                        aria-label="Supprimer l’action"
                        onClick={() => {
                          if (window.confirm('Supprimer cette action ?')) {
                            deleteActionMut.mutate(a.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {canActions ? (
                  <select
                    className="h-9 w-full max-w-xs rounded-lg border border-border bg-surface px-2 text-xs text-text"
                    value={a.statut}
                    disabled={statutMut.isPending}
                    onChange={(e) =>
                      statutMut.mutate({
                        id: a.id,
                        statut: e.target.value as StatutAction,
                      })
                    }
                  >
                    {(Object.keys(LIBELLES_STATUT_ACTION) as StatutAction[]).map((k) => (
                      <option key={k} value={k}>
                        {LIBELLES_STATUT_ACTION[k]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="neutral">{LIBELLES_STATUT_ACTION[a.statut]}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
