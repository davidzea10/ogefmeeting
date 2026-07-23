import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { CrSectionEditor } from '@/components/comptes-rendus/CrSectionEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  listerVersionsCompteRendu,
  modifierCompteRendu,
  obtenirCompteRendu,
  listerModelesCompteRendu,
} from '@/lib/comptes-rendus-api';
import {
  contenuEstVide,
  contenuVersHtml,
  preremplirContenuCr,
  sectionsDepuisModele,
  type ContenuCr,
} from '@/lib/cr-prefill';
import { formatDateHeure } from '@/lib/labels';
import { listerProfils, obtenirReunion } from '@/lib/reunions-api';
import { useAuthStore } from '@/stores/auth.store';
import type { SectionCompteRendu } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const LIBELLES_STATUT_CR: Record<string, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  en_revision: 'En révision',
  valide: 'Validé',
  archive: 'Archivé',
};

export function CompteRenduEditorPage() {
  const { id } = useParams<{ id: string }>();
  const announce = useAnnouncerStore((s) => s.announce);
  const profilId = useAuthStore((s) => s.profil?.id);
  const queryClient = useQueryClient();

  const [contenu, setContenu] = useState<ContenuCr>({});
  const [sections, setSections] = useState<SectionCompteRendu[]>([]);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showVersions, setShowVersions] = useState(false);
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

  const editable =
    crQuery.data?.statut === 'brouillon' || crQuery.data?.statut === 'en_revision';

  const optsHistoriserRef = useRef(false);

  // Initialisation contenu + sections (attendre modèles + profils pour un préremplissage complet)
  useEffect(() => {
    if (!crQuery.data || !reunionQuery.data || initDone.current) return;
    if (!modelesQuery.isFetched || !profilsQuery.isFetched) return;

    const modele = modelesQuery.data?.find((m) => m.id === reunionQuery.data!.modele_id) ??
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
      await queryClient.invalidateQueries({ queryKey: ['compte-rendu', id] });
      await queryClient.invalidateQueries({ queryKey: ['compte-rendu-versions', id] });
      await queryClient.invalidateQueries({
        queryKey: ['comptes-rendus', data.reunion_id],
      });
      if (optsHistoriserRef.current) {
        announce(`Version ${data.version} enregistrée.`);
      }
    },
    onError: (e: Error) => announce(e.message),
  });

  // Auto-save 30s
  useEffect(() => {
    if (!editable || !dirty || !initDone.current) return;
    const t = window.setTimeout(() => {
      optsHistoriserRef.current = false;
      saveMut.mutate({ historiser: false });
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [contenu, dirty, editable]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = useMemo(() => {
    if (saveMut.isPending) return 'Enregistrement…';
    if (dirty) return 'Modifications non enregistrées';
    if (lastSavedAt) return `Enregistré à ${lastSavedAt.toLocaleTimeString('fr-FR')}`;
    return 'À jour';
  }, [saveMut.isPending, dirty, lastSavedAt]);

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

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Réunions', href: '/reunions' },
          { label: reunion.titre, href: `/reunions/${reunion.id}?tab=compte-rendu` },
          { label: 'Compte rendu' },
        ]}
      />

      <header className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{LIBELLES_STATUT_CR[cr.statut] ?? cr.statut}</Badge>
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

        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button
                size="sm"
                loading={saveMut.isPending}
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
                onClick={() => {
                  optsHistoriserRef.current = true;
                  saveMut.mutate({ historiser: true });
                }}
              >
                Créer une version
              </Button>
            </>
          )}
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
            Ce compte rendu est en lecture seule (statut :{' '}
            {LIBELLES_STATUT_CR[cr.statut] ?? cr.statut}).
          </p>
        )}
      </header>

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
