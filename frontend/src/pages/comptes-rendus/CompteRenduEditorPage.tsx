import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CrDecisionsActionsPanel } from '@/components/comptes-rendus/CrDecisionsActionsPanel';
import { CrSectionEditor } from '@/components/comptes-rendus/CrSectionEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ajouterCommentaireCompteRendu,
  archiverCompteRendu,
  listerCommentairesCompteRendu,
  listerVersionsCompteRendu,
  modifierCompteRendu,
  obtenirCompteRendu,
  listerModelesCompteRendu,
  rejeterCompteRendu,
  soumettreCompteRendu,
  telechargerPdfCompteRendu,
  validerCompteRendu,
} from '@/lib/comptes-rendus-api';
import {
  contenuEstVide,
  contenuVersHtml,
  preremplirContenuCr,
  sectionsDepuisModele,
  type ContenuCr,
} from '@/lib/cr-prefill';
import {
  LIBELLES_STATUT_CR,
  messageWorkflowCr,
  peutApprouverCr,
  peutArchiverCr,
  peutModifierContenuCr,
  peutSoumettreCr,
  peutValiderCr,
} from '@/lib/cr-workflow';
import { formatDateHeure } from '@/lib/labels';
import { listerProfils, obtenirReunion } from '@/lib/reunions-api';
import { useAuthStore } from '@/stores/auth.store';
import type { SectionCompteRendu } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  Download,
  History,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

function badgeVariantPourStatut(statut: string): 'neutral' | 'warning' | 'success' | 'default' {
  if (statut === 'valide') return 'success';
  if (statut === 'soumis') return 'warning';
  if (statut === 'en_revision') return 'default';
  if (statut === 'archive') return 'neutral';
  return 'neutral';
}

const LIBELLES_TYPE_COMMENTAIRE: Record<string, string> = {
  note: 'Note',
  soumission: 'Soumission',
  validation: 'Validation',
  rejet: 'Rejet',
};

export function CompteRenduEditorPage() {
  const { id } = useParams<{ id: string }>();
  const announce = useAnnouncerStore((s) => s.announce);
  const profilId = useAuthStore((s) => s.profil?.id);
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const queryClient = useQueryClient();

  const [contenu, setContenu] = useState<ContenuCr>({});
  const [sections, setSections] = useState<SectionCompteRendu[]>([]);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [commentaireAction, setCommentaireAction] = useState('');
  const [noteLibre, setNoteLibre] = useState('');
  const initDone = useRef(false);

  const crQuery = useQuery({
    queryKey: ['compte-rendu', id],
    queryFn: () => obtenirCompteRendu(id!),
    enabled: Boolean(id),
  });

  const reunionQuery = useQuery({
    queryKey: ['reunion', crQuery.data?.reunion_id],
    queryFn: () => obtenirReunion(crQuery.data!.reunion_id),
    enabled: Boolean(crQuery.data?.reunion_id),
  });

  const modelesQuery = useQuery({
    queryKey: ['modeles-cr'],
    queryFn: listerModelesCompteRendu,
  });

  const profilsQuery = useQuery({
    queryKey: ['profils', 'cr'],
    queryFn: () => listerProfils({ limite: 100 }),
  });

  const versionsQuery = useQuery({
    queryKey: ['compte-rendu-versions', id],
    queryFn: () => listerVersionsCompteRendu(id!),
    enabled: Boolean(id) && showVersions,
  });

  const commentairesQuery = useQuery({
    queryKey: ['compte-rendu-commentaires', id],
    queryFn: () => listerCommentairesCompteRendu(id!),
    enabled: Boolean(id),
  });

  const statut = crQuery.data?.statut;
  const editable = Boolean(statut && peutModifierContenuCr(role, statut));

  const optsHistoriserRef = useRef(false);

  useEffect(() => {
    if (!crQuery.data || !reunionQuery.data || initDone.current) return;
    if (!modelesQuery.isFetched || !profilsQuery.isFetched) return;

    const modele =
      modelesQuery.data?.find((m) => m.id === reunionQuery.data!.modele_id) ??
      modelesQuery.data?.find((m) => m.est_par_defaut) ??
      null;

    const secs = sectionsDepuisModele(modele);
    setSections(secs);

    const profilMap = new Map<string, string>();
    for (const p of profilsQuery.data?.items ?? []) {
      profilMap.set(p.id, `${p.prenom} ${p.nom}`);
    }

    if (contenuEstVide(crQuery.data.contenu)) {
      const prefill = preremplirContenuCr(reunionQuery.data, secs, profilMap);
      setContenu(prefill);
      setDirty(true);
    } else {
      const existing: ContenuCr = {};
      for (const s of secs) {
        const raw = crQuery.data.contenu[s.cle];
        existing[s.cle] = typeof raw === 'string' ? raw : '<p></p>';
      }
      setContenu(existing);
    }

    initDone.current = true;
  }, [
    crQuery.data,
    reunionQuery.data,
    modelesQuery.data,
    modelesQuery.isFetched,
    profilsQuery.data,
    profilsQuery.isFetched,
  ]);

  const invalidateCr = async (reunionId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['compte-rendu', id] });
    await queryClient.invalidateQueries({ queryKey: ['compte-rendu-versions', id] });
    await queryClient.invalidateQueries({ queryKey: ['compte-rendu-commentaires', id] });
    await queryClient.invalidateQueries({ queryKey: ['comptes-rendus'] });
    if (reunionId) {
      await queryClient.invalidateQueries({ queryKey: ['comptes-rendus', reunionId] });
    }
  };

  const saveMut = useMutation({
    mutationFn: (opts: { historiser: boolean }) =>
      modifierCompteRendu(id!, {
        contenu,
        contenu_html: contenuVersHtml(sections, contenu),
        modifie_par: profilId ?? null,
        historiser: opts.historiser,
      }),
    onSuccess: async (data) => {
      setDirty(false);
      setLastSavedAt(new Date());
      await invalidateCr(data.reunion_id);
      if (optsHistoriserRef.current) {
        announce(`Version ${data.version} enregistrée.`);
      }
    },
    onError: (e: Error) => announce(e.message),
  });

  const soumettreMut = useMutation({
    mutationFn: async () => {
      if (dirty) {
        await modifierCompteRendu(id!, {
          contenu,
          contenu_html: contenuVersHtml(sections, contenu),
          modifie_par: profilId ?? null,
          historiser: true,
        });
        setDirty(false);
      }
      return soumettreCompteRendu(id!, {
        commentaire: commentaireAction.trim() || null,
        auteur_id: profilId ?? null,
      });
    },
    onSuccess: async (data) => {
      setCommentaireAction('');
      await invalidateCr(data.reunion_id);
      announce('Compte rendu soumis. Les directeurs ont été notifiés.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const validerMut = useMutation({
    mutationFn: () =>
      validerCompteRendu(id!, {
        valide_par: profilId ?? null,
        commentaire: commentaireAction.trim() || null,
      }),
    onSuccess: async (data) => {
      setCommentaireAction('');
      await invalidateCr(data.reunion_id);
      announce('Compte rendu validé. Le rédacteur a été notifié.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const rejeterMut = useMutation({
    mutationFn: () =>
      rejeterCompteRendu(id!, {
        commentaire: commentaireAction.trim(),
        auteur_id: profilId ?? null,
      }),
    onSuccess: async (data) => {
      setCommentaireAction('');
      await invalidateCr(data.reunion_id);
      announce('Compte rendu renvoyé en révision. Le rédacteur a été notifié.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const archiverMut = useMutation({
    mutationFn: () => archiverCompteRendu(id!),
    onSuccess: async (data) => {
      await invalidateCr(data.reunion_id);
      announce('Compte rendu archivé.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const pdfMut = useMutation({
    mutationFn: () => telechargerPdfCompteRendu(id!),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      announce('PDF téléchargé.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const noteMut = useMutation({
    mutationFn: () =>
      ajouterCommentaireCompteRendu(id!, {
        contenu: noteLibre.trim(),
        type: 'note',
        auteur_id: profilId ?? null,
      }),
    onSuccess: async () => {
      setNoteLibre('');
      await queryClient.invalidateQueries({ queryKey: ['compte-rendu-commentaires', id] });
      announce('Commentaire ajouté.');
    },
    onError: (e: Error) => announce(e.message),
  });

  useEffect(() => {
    if (!editable || !dirty || !initDone.current) return;
    const t = window.setTimeout(() => {
      optsHistoriserRef.current = false;
      saveMut.mutate({ historiser: false });
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [contenu, dirty, editable]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = useMemo(() => {
    if (saveMut.isPending || soumettreMut.isPending) return 'Enregistrement…';
    if (dirty) return 'Modifications non enregistrées';
    if (lastSavedAt) return `Enregistré à ${lastSavedAt.toLocaleTimeString('fr-FR')}`;
    return 'À jour';
  }, [saveMut.isPending, soumettreMut.isPending, dirty, lastSavedAt]);

  const workflowBusy =
    saveMut.isPending ||
    soumettreMut.isPending ||
    validerMut.isPending ||
    rejeterMut.isPending ||
    archiverMut.isPending ||
    pdfMut.isPending ||
    noteMut.isPending;

  if (!id) {
    return <p className="text-danger">Identifiant manquant.</p>;
  }

  if (crQuery.isLoading || reunionQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-text-muted">
        Chargement du compte rendu…
      </div>
    );
  }

  if (crQuery.isError || !crQuery.data || !reunionQuery.data) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-danger" role="alert">
        {crQuery.error instanceof Error ? crQuery.error.message : 'Compte rendu introuvable.'}
        <div className="mt-4">
          <Link to="/reunions">
            <Button variant="outline">Retour aux réunions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const cr = crQuery.data;
  const reunion = reunionQuery.data;
  const showSoumettre = peutSoumettreCr(role, cr.statut);
  const showValidation = peutApprouverCr(role, cr.statut);
  const showArchiver = peutArchiverCr(role, cr.statut);
  const showNoteDirecteur = peutValiderCr(role) && cr.statut === 'soumis';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Comptes rendus', href: '/comptes-rendus' },
          { label: reunion.titre, href: `/reunions/${reunion.id}?tab=compte-rendu` },
          { label: 'Édition' },
        ]}
      />

      <header className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariantPourStatut(cr.statut)}>
            {LIBELLES_STATUT_CR[cr.statut] ?? cr.statut}
          </Badge>
          <Badge variant="default">v{cr.version}</Badge>
          <span className="text-xs text-text-muted">{statusLabel}</span>
        </div>
        <h2 className="text-xl font-bold text-text sm:text-2xl">
          Compte rendu — {reunion.titre}
        </h2>
        <p className="text-sm text-text-muted">
          {formatDateHeure(reunion.date_prevue)}
          {reunion.lieu ? ` · ${reunion.lieu}` : ''}
        </p>

        <p
          className="rounded-lg border border-border bg-surface-muted/70 px-3 py-2 text-sm text-text"
          role="status"
        >
          {messageWorkflowCr(cr.statut)}
          {cr.soumis_le ? ` · Soumis le ${formatDateHeure(cr.soumis_le)}` : ''}
          {cr.valide_le ? ` · Validé le ${formatDateHeure(cr.valide_le)}` : ''}
        </p>

        {(showSoumettre || showValidation) && (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-text">
              {showValidation
                ? 'Commentaire / motif (obligatoire pour renvoyer en révision)'
                : 'Message optionnel à la soumission'}
            </span>
            <textarea
              className="min-h-[4.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-text"
              value={commentaireAction}
              onChange={(e) => setCommentaireAction(e.target.value)}
              placeholder={
                showValidation
                  ? 'Ex. Merci de préciser la décision sur le point 3…'
                  : 'Ex. CR prêt pour relecture…'
              }
            />
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button
                size="sm"
                loading={saveMut.isPending}
                disabled={workflowBusy}
                onClick={() => {
                  optsHistoriserRef.current = false;
                  saveMut.mutate({ historiser: false });
                  announce('Brouillon enregistré.');
                }}
              >
                <Save className="h-4 w-4" aria-hidden />
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={saveMut.isPending}
                disabled={workflowBusy}
                onClick={() => {
                  optsHistoriserRef.current = true;
                  saveMut.mutate({ historiser: true });
                }}
              >
                Créer une version
              </Button>
            </>
          )}

          {showSoumettre && (
            <Button
              size="sm"
              variant="outline"
              loading={soumettreMut.isPending}
              disabled={workflowBusy}
              onClick={() => {
                if (
                  window.confirm(
                    'Soumettre ce compte rendu pour validation ? Les directeurs seront notifiés.',
                  )
                ) {
                  soumettreMut.mutate();
                }
              }}
            >
              <Send className="h-4 w-4" aria-hidden />
              Soumettre pour validation
            </Button>
          )}

          {showValidation && (
            <>
              <Button
                size="sm"
                loading={validerMut.isPending}
                disabled={workflowBusy}
                onClick={() => {
                  if (window.confirm('Valider définitivement ce compte rendu ?')) {
                    validerMut.mutate();
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Approuver
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={rejeterMut.isPending}
                disabled={workflowBusy || commentaireAction.trim().length < 5}
                onClick={() => {
                  if (commentaireAction.trim().length < 5) {
                    announce('Indiquez un motif d’au moins 5 caractères.');
                    return;
                  }
                  if (
                    window.confirm(
                      'Renvoyer ce compte rendu en révision avec ce motif ?',
                    )
                  ) {
                    rejeterMut.mutate();
                  }
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Rejeter / révision
              </Button>
            </>
          )}

          {showArchiver && (
            <Button
              size="sm"
              variant="outline"
              loading={archiverMut.isPending}
              disabled={workflowBusy}
              onClick={() => {
                if (window.confirm('Archiver ce compte rendu validé ?')) {
                  archiverMut.mutate();
                }
              }}
            >
              <Archive className="h-4 w-4" aria-hidden />
              Archiver
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            loading={pdfMut.isPending}
            disabled={workflowBusy}
            onClick={() => pdfMut.mutate()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Télécharger PDF
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowVersions((v) => !v)}
          >
            <History className="h-4 w-4" aria-hidden />
            Historique
          </Button>
          <Link to={`/reunions/${reunion.id}?tab=compte-rendu`}>
            <Button size="sm" variant="ghost">
              Retour réunion
            </Button>
          </Link>
        </div>

        {!editable && (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-text-muted">
            {cr.statut === 'soumis'
              ? 'Compte rendu soumis — en attente de validation. Seul un directeur peut encore ajuster le contenu.'
              : `Ce compte rendu est en lecture seule (statut : ${
                  LIBELLES_STATUT_CR[cr.statut] ?? cr.statut
                }).`}
          </p>
        )}
        {editable && cr.statut === 'soumis' && (
          <p className="rounded-lg border border-ogefrem-blue/20 bg-ogefrem-blue/5 px-3 py-2 text-sm text-ogefrem-blue">
            Vous pouvez ajuster le contenu avant de valider ou de renvoyer en révision.
          </p>
        )}
      </header>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
          <MessageSquare className="h-4 w-4 text-ogefrem-blue" aria-hidden />
          Commentaires de validation
        </h3>

        {commentairesQuery.isLoading && (
          <p className="text-sm text-text-muted">Chargement des commentaires…</p>
        )}
        {commentairesQuery.isError && (
          <p className="text-sm text-danger">
            Impossible de charger les commentaires. Vérifiez que la migration SQL a été
            appliquée sur Supabase.
          </p>
        )}
        {commentairesQuery.isSuccess && commentairesQuery.data.length === 0 && (
          <p className="text-sm text-text-muted">Aucun commentaire pour l’instant.</p>
        )}
        {commentairesQuery.isSuccess && commentairesQuery.data.length > 0 && (
          <ul className="mb-4 space-y-3">
            {commentairesQuery.data.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={c.type === 'rejet' ? 'warning' : 'neutral'}>
                    {LIBELLES_TYPE_COMMENTAIRE[c.type] ?? c.type}
                  </Badge>
                  <span className="font-medium text-text">
                    {c.auteur_nom ?? 'Utilisateur'}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatDateHeure(c.cree_le)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-text">{c.contenu}</p>
              </li>
            ))}
          </ul>
        )}

        {showNoteDirecteur && (
          <div className="space-y-2 border-t border-border pt-3">
            <label className="block text-sm font-medium text-text">
              Ajouter une note (sans changer le statut)
            </label>
            <textarea
              className="min-h-[3.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              value={noteLibre}
              onChange={(e) => setNoteLibre(e.target.value)}
              placeholder="Observation pour le secrétaire…"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={workflowBusy || noteLibre.trim().length === 0}
              loading={noteMut.isPending}
              onClick={() => noteMut.mutate()}
            >
              Publier la note
            </Button>
          </div>
        )}
      </section>

      {showVersions && (
        <aside className="rounded-xl border border-border bg-surface p-4 text-sm">
          <h3 className="mb-2 font-semibold text-text">Versions enregistrées</h3>
          {versionsQuery.isLoading && <p className="text-text-muted">Chargement…</p>}
          {versionsQuery.isSuccess && versionsQuery.data.length === 0 && (
            <p className="text-text-muted">
              Aucune version historisée. Utilisez « Créer une version » pour en créer une.
            </p>
          )}
          {versionsQuery.isSuccess && versionsQuery.data.length > 0 && (
            <ul className="divide-y divide-border">
              {versionsQuery.data.map((v) => (
                <li key={v.id} className="flex justify-between py-2">
                  <span className="font-medium">Version {v.version}</span>
                  <span className="text-text-muted">{formatDateHeure(v.cree_le)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      <CrDecisionsActionsPanel
        reunionId={reunion.id}
        compteRenduId={cr.id}
        profils={profilsQuery.data?.items ?? []}
        editable={cr.statut !== 'archive'}
      />

      <div className="space-y-3">
        {sections.map((section, index) => (
          <CrSectionEditor
            key={section.cle}
            sectionCle={section.cle}
            libelle={section.libelle}
            valueHtml={contenu[section.cle] ?? '<p></p>'}
            editable={editable}
            defaultOpen={index < 3}
            onChange={(cle, html) => {
              setContenu((prev) => ({ ...prev, [cle]: html }));
              setDirty(true);
            }}
          />
        ))}
      </div>
    </div>
  );
}
