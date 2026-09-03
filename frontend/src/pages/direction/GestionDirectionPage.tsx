import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  creerMembre,
  desactiverMembre,
  listerDirectionsAdmin,
  listerProfilsAdmin,
  modifierMembre,
  reactiverMembre,
} from '@/lib/admin-api';
import {
  estSuperAdmin,
  LIBELLES_FONCTION,
  LIBELLES_ROLE,
} from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import {
  FONCTIONS_ORGANISATION,
  MOT_DE_PASSE_DEFAUT,
  type FonctionOrganisation,
  type Profil,
  type RoleUtilisateur,
} from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

export function GestionDirectionPage() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const profil = useAuthStore((s) => s.profil);
  const role = useAuthStore((s) => s.role ?? profil?.role ?? null);
  const estAdmin = estSuperAdmin(role);

  const [recherche, setRecherche] = useState('');
  const [filtreActif, setFiltreActif] = useState<'tous' | 'actifs' | 'inactifs'>('actifs');
  const [filtreDirection, setFiltreDirection] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mdpCree, setMdpCree] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    prenom: '',
    nom: '',
    direction_id: '',
    fonction: 'agent' as FonctionOrganisation,
    matricule: '',
  });

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirectionsAdmin,
  });

  const directionScope = estAdmin
    ? filtreDirection || undefined
    : profil?.direction_id ?? undefined;

  const profilsQuery = useQuery({
    queryKey: ['gestion-direction', 'profils', { recherche, filtreActif, directionScope }],
    queryFn: () =>
      listerProfilsAdmin({
        page: 1,
        limite: 100,
        recherche: recherche.trim() || undefined,
        direction_id: directionScope,
        est_actif:
          filtreActif === 'tous' ? undefined : filtreActif === 'actifs',
      }),
  });

  const maDirection = useMemo(() => {
    if (!profil?.direction_id) return null;
    return directionsQuery.data?.find((d) => d.id === profil.direction_id) ?? null;
  }, [directionsQuery.data, profil?.direction_id]);

  const statsFonction = useMemo(() => {
    const items = profilsQuery.data?.items ?? [];
    const actifs = items.filter((p) => p.est_actif);
    const parFonction = new Map<string, number>();
    for (const p of actifs) {
      const fn = p.fonction ?? 'agent';
      parFonction.set(fn, (parFonction.get(fn) ?? 0) + 1);
    }
    return {
      total: items.length,
      actifs: actifs.length,
      inactifs: items.length - actifs.length,
      parFonction,
    };
  }, [profilsQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['gestion-direction', 'profils'] });

  const creerMut = useMutation({
    mutationFn: () => {
      if (!form.prenom.trim() || !form.nom.trim()) {
        throw new Error('Prénom et nom sont obligatoires.');
      }
      return creerMembre({
        email: form.email.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        direction_id: estAdmin ? form.direction_id || null : profil?.direction_id ?? null,
        fonction: form.fonction,
        matricule: form.matricule.trim() || null,
      });
    },
    onSuccess: async (data) => {
      setMdpCree(data.mot_de_passe_temporaire);
      setShowForm(false);
      resetForm();
      await invalidate();
      announce(`Membre ajouté. Mot de passe : ${data.mot_de_passe_temporaire}`);
    },
    onError: (e: Error) => announce(e.message),
  });

  const modifierMut = useMutation({
    mutationFn: () =>
      modifierMembre(editId!, {
        email: form.email.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        direction_id: estAdmin ? form.direction_id || null : undefined,
        fonction: form.fonction,
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
      direction_id: profil?.direction_id ?? '',
      fonction: 'agent',
      matricule: '',
    });
  }

  function startEdit(p: Profil) {
    setEditId(p.id);
    setShowForm(true);
    setForm({
      email: p.email,
      prenom: p.prenom,
      nom: p.nom,
      direction_id: p.direction_id ?? '',
      fonction: (p.fonction as FonctionOrganisation) || 'agent',
      matricule: p.matricule ?? '',
    });
  }

  const directionsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of directionsQuery.data ?? []) {
      m.set(d.id, d.code ? `${d.code} — ${d.nom}` : d.nom);
    }
    return m;
  }, [directionsQuery.data]);

  const titre = estAdmin ? 'Gestion des directions' : 'Ma direction';
  const sousTitre = estAdmin
    ? 'Vue globale des membres par direction.'
    : maDirection
      ? `${maDirection.nom}${maDirection.code ? ` (${maDirection.code})` : ''}`
      : 'Membres de votre direction.';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumbs items={[{ label: titre }]} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">{titre}</h2>
          <p className="mt-1 text-sm text-text-muted">{sousTitre}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setEditId(null);
            setShowForm((v) => !v);
          }}
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          {showForm && !editId ? 'Fermer' : 'Ajouter un membre'}
        </Button>
      </header>

      {mdpCree && (
        <p
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          Mot de passe initial : <strong>{mdpCree}</strong> (communiquer au membre)
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => setMdpCree(null)}>
            OK
          </Button>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Membres"
          value={statsFonction.total}
          detail={`${statsFonction.actifs} actifs · ${statsFonction.inactifs} inactifs`}
        />
        {FONCTIONS_ORGANISATION.map((fn) => {
          const count = statsFonction.parFonction.get(fn) ?? 0;
          if (count === 0 && !estAdmin) return null;
          return (
            <StatCard
              key={fn}
              icon={Building2}
              label={LIBELLES_FONCTION[fn]}
              value={count}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input
          className="h-10 min-w-[12rem] flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          placeholder="Rechercher nom, email, matricule…"
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
        {estAdmin && (
          <select
            className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
            value={filtreDirection}
            onChange={(e) => setFiltreDirection(e.target.value)}
          >
            <option value="">Toutes les directions</option>
            {(directionsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.code ? `${d.code} — ${d.nom}` : d.nom}
              </option>
            ))}
          </select>
        )}
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
            {editId ? 'Modifier le membre' : 'Nouveau membre'}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              required
              className="h-10 rounded-lg border border-border px-3 text-sm sm:col-span-2"
              placeholder="Email (connexion / professionnel) *"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            {!editId && (
              <p className="text-xs text-text-muted sm:col-span-2">
                Mot de passe par défaut : <code>{MOT_DE_PASSE_DEFAUT}</code>
              </p>
            )}
            {editId && (
              <p className="text-xs text-text-muted sm:col-span-2">
                Modifier l’email met à jour l’adresse de connexion et celle utilisée pour les
                invitations / CR.
              </p>
            )}
            <input
              required
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text"
              placeholder="Prénom *"
              value={form.prenom}
              onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
            />
            <input
              required
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text"
              placeholder="Nom *"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            />
            <input
              className="h-10 rounded-lg border border-border px-3 text-sm"
              placeholder="Matricule (optionnel)"
              value={form.matricule}
              onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
            />
            <select
              className="h-10 rounded-lg border border-border px-2 text-sm"
              value={form.fonction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fonction: e.target.value as FonctionOrganisation,
                }))
              }
            >
              {FONCTIONS_ORGANISATION.map((fn) => (
                <option key={fn} value={fn}>
                  {LIBELLES_FONCTION[fn]}
                </option>
              ))}
            </select>
            {estAdmin && (
              <select
                required={!editId}
                className="h-10 rounded-lg border border-border px-2 text-sm sm:col-span-2"
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
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            loading={creerMut.isPending || modifierMut.isPending}
          >
            {editId ? 'Enregistrer' : 'Créer le membre'}
          </Button>
        </form>
      )}

      {profilsQuery.isLoading && (
        <p className="text-sm text-text-muted">Chargement des membres…</p>
      )}

      {profilsQuery.isError && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {(profilsQuery.error as Error).message || 'Impossible de charger les membres.'}
        </p>
      )}

      {profilsQuery.isSuccess && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-semibold">Membre</th>
                  {estAdmin && (
                    <th className="px-4 py-3 font-semibold">Direction</th>
                  )}
                  <th className="px-4 py-3 font-semibold">Fonction</th>
                  <th className="px-4 py-3 font-semibold">Rôle</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profilsQuery.data.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={estAdmin ? 6 : 5}
                      className="px-4 py-8 text-center text-text-muted"
                    >
                      Aucun membre trouvé.
                    </td>
                  </tr>
                ) : (
                  profilsQuery.data.items.map((p) => {
                    const nomAff =
                      p.prenom || p.nom
                        ? `${p.prenom} ${p.nom}`.trim()
                        : p.email;
                    const estMoi = p.id === profil?.id;
                    return (
                      <tr
                        key={p.id}
                        className="bg-surface transition hover:bg-surface-muted/40"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={nomAff} src={p.url_avatar} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text">
                                {nomAff}
                                {estMoi && (
                                  <span className="ml-1.5 text-xs text-text-muted">
                                    (vous)
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-text-muted">
                                {p.email}
                                {p.matricule ? ` · ${p.matricule}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        {estAdmin && (
                          <td className="px-4 py-3 text-text-muted">
                            {p.direction_id
                              ? directionsMap.get(p.direction_id) ?? '—'
                              : '—'}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {p.fonction
                            ? LIBELLES_FONCTION[p.fonction as FonctionOrganisation]
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {LIBELLES_ROLE[p.role as RoleUtilisateur]}
                        </td>
                        <td className="px-4 py-3">
                          {p.est_actif ? (
                            <Badge variant="success">Actif</Badge>
                          ) : (
                            <Badge variant="warning">Inactif</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(p)}
                            >
                              Modifier
                            </Button>
                            {p.est_actif ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-danger"
                                disabled={estMoi}
                                onClick={() => desactiverMut.mutate(p.id)}
                              >
                                Désactiver
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => reactiverMut.mutate(p.id)}
                              >
                                Réactiver
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <div className="rounded-lg bg-ogefrem-blue/10 p-2 text-ogefrem-blue">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text">{value}</p>
          {detail && <p className="text-xs text-text-muted">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
