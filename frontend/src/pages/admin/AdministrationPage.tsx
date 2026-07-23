import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  creerDirection,
  creerMembre,
  creerModele,
  desactiverMembre,
  listerDirectionsAdmin,
  listerModelesAdmin,
  listerProfilsAdmin,
  modifierDirection,
  modifierMembre,
  modifierModele,
  reactiverMembre,
} from '@/lib/admin-api';
import {
  listerAudit,
  modifierParametres,
  obtenirParametres,
} from '@/lib/notifications-api';
import {
  estSuperAdmin,
  LIBELLES_FONCTION,
  LIBELLES_ROLE,
} from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import {
  FONCTIONS_ORGANISATION,
  ROLES_ASSIGNABLES_ADMIN,
  MOT_DE_PASSE_DEFAUT,
  roleDepuisFonction,
  type FonctionOrganisation,
  type RoleAssignableAdmin,
  type RoleUtilisateur,
  type SectionCompteRendu,
} from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { formatDateHeure } from '@/lib/labels';

type TabId = 'utilisateurs' | 'directions' | 'modeles' | 'parametres' | 'audit';

export function AdministrationPage() {
  const role = useAuthStore((s) => s.role ?? s.profil?.role ?? null);
  const [params, setParams] = useSearchParams();
  const isAdmin = estSuperAdmin(role);
  const peutAudit = isAdmin || role === 'directeur';
  const tab = (params.get('tab') as TabId) || (isAdmin ? 'utilisateurs' : 'audit');

  useEffect(() => {
    if (!params.get('tab')) {
      setParams({ tab: isAdmin ? 'utilisateurs' : 'audit' }, { replace: true });
    }
  }, [params, setParams, isAdmin]);

  if (!isAdmin && !peutAudit) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-danger/30 bg-danger/10 p-6 text-danger">
        Accès réservé à l’administrateur.
        <div className="mt-4">
          <Link to="/">
            <Button variant="outline">Retour au tableau de bord</Button>
          </Link>
        </div>
      </div>
    );
  }

  const tabs = (
    isAdmin
      ? ([
          ['utilisateurs', 'Utilisateurs'],
          ['directions', 'Directions'],
          ['modeles', 'Modèles CR'],
          ['parametres', 'Paramètres'],
          ['audit', 'Journal d’audit'],
        ] as const)
      : ([['audit', 'Journal d’audit']] as const)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumbs items={[{ label: 'Administration' }]} />
      <header>
        <h2 className="text-2xl font-bold text-text">Administration</h2>
        <p className="mt-1 text-sm text-text-muted">
          {isAdmin
            ? 'Membres, directions, modèles, paramètres et audit.'
            : 'Consultation du journal d’audit.'}
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setParams({ tab: id })}
            className={
              tab === id
                ? 'rounded-t-lg border border-b-0 border-border bg-surface px-3 py-2 text-sm font-semibold text-ogefrem-blue'
                : 'px-3 py-2 text-sm font-semibold text-text-muted hover:text-text'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {isAdmin && tab === 'utilisateurs' && <UtilisateursPanel />}
      {isAdmin && tab === 'directions' && <DirectionsPanel />}
      {isAdmin && tab === 'modeles' && <ModelesPanel />}
      {isAdmin && tab === 'parametres' && <ParametresPanel />}
      {peutAudit && tab === 'audit' && <AuditPanel />}
    </div>
  );
}

function UtilisateursPanel() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const [recherche, setRecherche] = useState('');
  const [filtreActif, setFiltreActif] = useState<'tous' | 'actifs' | 'inactifs'>('tous');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mdpCree, setMdpCree] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    prenom: '',
    nom: '',
    /** Vide = dérivé de la fonction */
    role: '' as '' | RoleAssignableAdmin,
    direction_id: '',
    fonction: '' as '' | FonctionOrganisation,
    matricule: '',
  });

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirectionsAdmin,
  });

  const profilsQuery = useQuery({
    queryKey: ['admin', 'profils', { recherche, filtreActif }],
    queryFn: () =>
      listerProfilsAdmin({
        page: 1,
        limite: 100,
        recherche: recherche.trim() || undefined,
        est_actif:
          filtreActif === 'tous' ? undefined : filtreActif === 'actifs',
      }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'profils'] });

  const creerMut = useMutation({
    mutationFn: () =>
      creerMembre({
        email: form.email.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        role: form.role || undefined,
        direction_id: form.direction_id || null,
        fonction: form.fonction || null,
        matricule: form.matricule.trim() || null,
      }),
    onSuccess: async (data) => {
      setMdpCree(data.mot_de_passe_temporaire);
      setShowForm(false);
      resetForm();
      await invalidate();
      announce(`Membre créé. Mot de passe : ${data.mot_de_passe_temporaire}`);
    },
    onError: (e: Error) => announce(e.message),
  });

  const modifierMut = useMutation({
    mutationFn: () =>
      modifierMembre(editId!, {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        role: form.role || roleDepuisFonction(form.fonction || null),
        direction_id: form.direction_id || null,
        fonction: form.fonction || null,
        matricule: form.matricule.trim() || null,
      }),
    onSuccess: async () => {
      setEditId(null);
      setShowForm(false);
      resetForm();
      await invalidate();
      announce('Membre mis à jour.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const desactiverMut = useMutation({
    mutationFn: (id: string) => desactiverMembre(id),
    onSuccess: async () => {
      await invalidate();
      announce('Membre désactivé.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const reactiverMut = useMutation({
    mutationFn: (id: string) => reactiverMembre(id),
    onSuccess: async () => {
      await invalidate();
      announce('Membre réactivé.');
    },
    onError: (e: Error) => announce(e.message),
  });

  function resetForm() {
    setForm({
      email: '',
      prenom: '',
      nom: '',
      role: '',
      direction_id: '',
      fonction: '',
      matricule: '',
    });
  }

  function startEdit(p: {
    id: string;
    email: string;
    prenom: string;
    nom: string;
    role: RoleUtilisateur;
    direction_id: string | null;
    fonction: string | null;
    matricule: string | null;
  }) {
    setEditId(p.id);
    setShowForm(true);
    const roleSpecial = (ROLES_ASSIGNABLES_ADMIN as readonly string[]).includes(p.role)
      ? (p.role as RoleAssignableAdmin)
      : '';
    setForm({
      email: p.email,
      prenom: p.prenom,
      nom: p.nom,
      role: roleSpecial,
      direction_id: p.direction_id ?? '',
      fonction: (p.fonction as FonctionOrganisation) || '',
      matricule: p.matricule ?? '',
    });
  }

  const directionsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of directionsQuery.data ?? []) {
      m.set(d.id, d.code ? `${d.code}` : d.nom);
    }
    return m;
  }, [directionsQuery.data]);

  return (
    <div className="space-y-4">
      {mdpCree && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success" role="status">
          Mot de passe initial : <strong>{mdpCree}</strong> (communiquer au membre)
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => setMdpCree(null)}>
            OK
          </Button>
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            className="h-10 min-w-[12rem] flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
            placeholder="Rechercher nom / email…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          <select
            className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
            value={filtreActif}
            onChange={(e) => setFiltreActif(e.target.value as typeof filtreActif)}
          >
            <option value="tous">Tous</option>
            <option value="actifs">Actifs</option>
            <option value="inactifs">Inactifs</option>
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setEditId(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editId ? 'Fermer' : 'Nouveau membre'}
        </Button>
      </div>

      {showForm && (
        <form
          className="space-y-3 rounded-xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editId) modifierMut.mutate();
            else creerMut.mutate();
          }}
        >
          <h3 className="font-semibold text-text">
            {editId ? 'Modifier le membre' : 'Créer un membre'}
          </h3>
          {!editId && (
            <p className="text-xs text-text-muted">
              Mot de passe par défaut : <code>{MOT_DE_PASSE_DEFAUT}</code>
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              required
              disabled={Boolean(editId)}
              className="h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-60"
              placeholder="Email (connexion) *"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="h-10 rounded-lg border border-border px-3 text-sm"
              placeholder="Matricule (optionnel)"
              value={form.matricule}
              onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
            />
            <input
              className="h-10 rounded-lg border border-border px-3 text-sm"
              placeholder="Prénom (optionnel)"
              value={form.prenom}
              onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
            />
            <input
              className="h-10 rounded-lg border border-border px-3 text-sm"
              placeholder="Nom (optionnel)"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            />
            <select
              className="h-10 rounded-lg border border-border px-2 text-sm"
              value={form.direction_id}
              onChange={(e) => setForm((f) => ({ ...f, direction_id: e.target.value }))}
            >
              <option value="">— Direction —</option>
              {(directionsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ? `${d.code} — ${d.nom}` : d.nom}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-border px-2 text-sm"
              value={form.fonction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fonction: e.target.value as '' | FonctionOrganisation,
                }))
              }
            >
              <option value="">— Fonction —</option>
              {FONCTIONS_ORGANISATION.map((fn) => (
                <option key={fn} value={fn}>
                  {LIBELLES_FONCTION[fn]}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-border px-2 text-sm sm:col-span-2"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as '' | RoleAssignableAdmin,
                }))
              }
            >
              <option value="">Rôle : selon fonction (membre / direction)</option>
              {ROLES_ASSIGNABLES_ADMIN.map((r) => (
                <option key={r} value={r}>
                  {LIBELLES_ROLE[r]}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            size="sm"
            loading={creerMut.isPending || modifierMut.isPending}
          >
            {editId ? 'Enregistrer' : 'Créer'}
          </Button>
        </form>
      )}

      {profilsQuery.isLoading && <p className="text-sm text-text-muted">Chargement…</p>}
      {profilsQuery.isSuccess && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {profilsQuery.data.items.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-text">
                  {p.prenom || p.nom
                    ? `${p.prenom} ${p.nom}`.trim()
                    : p.email}
                  {!p.est_actif && (
                    <Badge variant="warning" className="ml-2">
                      Inactif
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-text-muted">
                  {p.email}
                  {p.matricule ? ` · Mat. ${p.matricule}` : ''}
                  {' · '}
                  {directionsMap.get(p.direction_id ?? '') ?? 'Sans direction'}
                  {' · '}
                  {p.fonction
                    ? LIBELLES_FONCTION[p.fonction as FonctionOrganisation] ?? p.fonction
                    : '—'}
                  {' · '}
                  {LIBELLES_ROLE[p.role]}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                  Modifier
                </Button>
                {p.est_actif ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Désactiver ${p.prenom || p.nom || p.email} ?`)) {
                        desactiverMut.mutate(p.id);
                      }
                    }}
                  >
                    Désactiver
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => reactiverMut.mutate(p.id)}>
                    Réactiver
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DirectionsPanel() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirectionsAdmin,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editId) {
        return modifierDirection(editId, {
          nom: nom.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
        });
      }
      return creerDirection({
        nom: nom.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
      });
    },
    onSuccess: async () => {
      setEditId(null);
      setNom('');
      setCode('');
      setDescription('');
      await queryClient.invalidateQueries({ queryKey: ['directions'] });
      announce(editId ? 'Direction mise à jour.' : 'Direction créée.');
    },
    onError: (e: Error) => announce(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (nom.trim().length < 2) return;
          saveMut.mutate();
        }}
      >
        <input
          className="h-10 rounded-lg border border-border px-3 text-sm"
          placeholder="Nom *"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
        <input
          className="h-10 rounded-lg border border-border px-3 text-sm"
          placeholder="Code (ex. DGIT)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <input
          className="h-10 rounded-lg border border-border px-3 text-sm"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" size="sm" loading={saveMut.isPending}>
          {editId ? 'Enregistrer' : 'Ajouter'}
        </Button>
        {editId && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditId(null);
              setNom('');
              setCode('');
              setDescription('');
            }}
          >
            Annuler
          </Button>
        )}
      </form>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {(query.data ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold text-text">
                {d.code ? `${d.code} — ` : ''}
                {d.nom}
              </p>
              {d.description && (
                <p className="text-xs text-text-muted">{d.description}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditId(d.id);
                setNom(d.nom);
                setCode(d.code ?? '');
                setDescription(d.description ?? '');
              }}
            >
              Modifier
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelesPanel() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const [nom, setNom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [description, setDescription] = useState('');
  const [sectionsText, setSectionsText] = useState(
    'contexte:Contexte\nparticipants:Participants\ndecisions:Décisions\nactions:Actions',
  );
  const [editId, setEditId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['modeles-cr'],
    queryFn: listerModelesAdmin,
  });

  function parseSections(text: string): SectionCompteRendu[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [cle, ...rest] = line.split(':');
        return {
          cle: (cle ?? '').trim(),
          libelle: rest.join(':').trim() || (cle ?? '').trim(),
        };
      })
      .filter((s) => s.cle.length > 0);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const sections = parseSections(sectionsText);
      if (editId) {
        return modifierModele(editId, {
          nom: nom.trim(),
          description: description.trim() || null,
          sections,
        });
      }
      return creerModele({
        nom: nom.trim(),
        identifiant: identifiant.trim().toLowerCase().replace(/\s+/g, '_'),
        description: description.trim() || null,
        sections,
      });
    },
    onSuccess: async () => {
      setEditId(null);
      setNom('');
      setIdentifiant('');
      setDescription('');
      await queryClient.invalidateQueries({ queryKey: ['modeles-cr'] });
      announce(editId ? 'Modèle mis à jour.' : 'Modèle créé.');
    },
    onError: (e: Error) => announce(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate();
        }}
      >
        <h3 className="font-semibold text-text">
          {editId ? 'Modifier le modèle' : 'Nouveau modèle'}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            required
            className="h-10 rounded-lg border border-border px-3 text-sm"
            placeholder="Nom *"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
          <input
            required={!editId}
            disabled={Boolean(editId)}
            className="h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-60"
            placeholder="Identifiant (ex. conseil_direction) *"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
          />
        </div>
        <input
          className="h-10 w-full rounded-lg border border-border px-3 text-sm"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="block text-xs text-text-muted">
          Sections (une par ligne : cle:Libellé)
          <textarea
            className="mt-1 min-h-[6rem] w-full rounded-lg border border-border px-3 py-2 text-sm text-text"
            value={sectionsText}
            onChange={(e) => setSectionsText(e.target.value)}
          />
        </label>
        <Button type="submit" size="sm" loading={saveMut.isPending}>
          {editId ? 'Enregistrer' : 'Créer'}
        </Button>
      </form>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {(query.data ?? []).map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold text-text">
                {m.nom}
                {m.est_par_defaut && (
                  <Badge variant="default" className="ml-2">
                    Par défaut
                  </Badge>
                )}
              </p>
              <p className="text-xs text-text-muted">
                {m.identifiant} · {m.sections?.length ?? 0} section(s)
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditId(m.id);
                setNom(m.nom);
                setIdentifiant(m.identifiant);
                setDescription(m.description ?? '');
                setSectionsText(
                  (m.sections ?? [])
                    .map((s) => `${s.cle}:${s.libelle}`)
                    .join('\n'),
                );
              }}
            >
              Modifier
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParametresPanel() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['parametres'],
    queryFn: obtenirParametres,
  });

  const [logoUrl, setLogoUrl] = useState('');
  const [enTete, setEnTete] = useState('');
  const [sousTitre, setSousTitre] = useState('');
  const [retention, setRetention] = useState(365);

  useEffect(() => {
    if (!query.data) return;
    setLogoUrl(query.data.logo_url ?? '');
    setEnTete(query.data.en_tete_pdf);
    setSousTitre(query.data.sous_titre_pdf);
    setRetention(query.data.duree_retention_jours);
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      modifierParametres({
        logo_url: logoUrl.trim() || null,
        en_tete_pdf: enTete.trim(),
        sous_titre_pdf: sousTitre.trim(),
        duree_retention_jours: retention,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parametres'] });
      announce('Paramètres enregistrés.');
    },
    onError: (e: Error) => announce(e.message),
  });

  if (query.isLoading) {
    return <p className="text-sm text-text-muted">Chargement…</p>;
  }

  return (
    <form
      className="max-w-xl space-y-4 rounded-xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        saveMut.mutate();
      }}
    >
      <h3 className="font-semibold text-text">Paramètres généraux</h3>
      <label className="block space-y-1 text-sm">
        <span className="text-text-muted">URL du logo (optionnel)</span>
        <input
          className="h-10 w-full rounded-lg border border-border px-3"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-text-muted">En-tête PDF</span>
        <input
          required
          className="h-10 w-full rounded-lg border border-border px-3"
          value={enTete}
          onChange={(e) => setEnTete(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-text-muted">Sous-titre PDF</span>
        <input
          required
          className="h-10 w-full rounded-lg border border-border px-3"
          value={sousTitre}
          onChange={(e) => setSousTitre(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-text-muted">Durée de rétention (jours)</span>
        <input
          type="number"
          min={30}
          max={3650}
          required
          className="h-10 w-full rounded-lg border border-border px-3"
          value={retention}
          onChange={(e) => setRetention(Number(e.target.value))}
        />
        <span className="text-xs text-text-muted">
          Référence pour l’archivage / purge des anciennes données (30–3650).
        </span>
      </label>
      <Button type="submit" size="sm" loading={saveMut.isPending}>
        Enregistrer
      </Button>
    </form>
  );
}

function AuditPanel() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['audit', { action, page }],
    queryFn: () =>
      listerAudit({
        page,
        limite: 30,
        action: action.trim() || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="h-10 min-w-[14rem] flex-1 rounded-lg border border-border px-3 text-sm"
          placeholder="Filtrer par action (ex. auth.connexion)…"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading && <p className="text-sm text-text-muted">Chargement…</p>}
      {query.isError && (
        <p className="text-sm text-danger">
          {query.error instanceof Error ? query.error.message : 'Erreur audit'}
        </p>
      )}

      {query.isSuccess && (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {query.data.items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-text-muted">
                Aucun événement.
              </li>
            )}
            {query.data.items.map((j) => (
              <li key={j.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-text">{j.action}</p>
                  <p className="text-xs text-text-muted">{formatDateHeure(j.cree_le)}</p>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {j.type_entite ? `${j.type_entite}` : '—'}
                  {j.entite_id ? ` · ${j.entite_id.slice(0, 8)}…` : ''}
                  {j.profil_id ? ` · profil ${j.profil_id.slice(0, 8)}…` : ''}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </Button>
            <span className="text-xs text-text-muted">
              Page {query.data.pagination.page} / {query.data.pagination.total_pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= query.data.pagination.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
