import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { modifierMonProfil, obtenirMonProfil } from '@/lib/profil-api';
import { LIBELLES_FONCTION, LIBELLES_ROLE } from '@/lib/roles';
import { listerDirectionsAdmin } from '@/lib/admin-api';
import { useAuthStore } from '@/stores/auth.store';
import type { FonctionOrganisation } from '@ogefmeeting/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function ProfilPage() {
  const announce = useAnnouncerStore((s) => s.announce);
  const queryClient = useQueryClient();
  const updateProfil = useAuthStore((s) => s.updateProfil);
  const profilStore = useAuthStore((s) => s.profil);

  const profilQuery = useQuery({
    queryKey: ['mon-profil'],
    queryFn: obtenirMonProfil,
  });

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: listerDirectionsAdmin,
  });

  const profil = profilQuery.data?.profil ?? profilStore;
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');

  useEffect(() => {
    if (profil) {
      setPrenom(profil.prenom ?? '');
      setNom(profil.nom ?? '');
    }
  }, [profil?.id, profil?.prenom, profil?.nom]);

  const directionLabel =
    profil?.direction_id &&
    (directionsQuery.data?.find((d) => d.id === profil.direction_id)?.nom ??
      '—');

  const displayName =
    profil && (profil.prenom || profil.nom)
      ? `${profil.prenom} ${profil.nom}`.trim()
      : (profil?.email ?? 'Mon profil');

  const modifierMut = useMutation({
    mutationFn: () =>
      modifierMonProfil({
        prenom: prenom.trim(),
        nom: nom.trim(),
      }),
    onSuccess: async (data) => {
      updateProfil(data);
      await queryClient.invalidateQueries({ queryKey: ['mon-profil'] });
      announce('Profil mis à jour.');
    },
    onError: (e: Error) => announce(e.message),
  });

  const modifie =
    profil &&
    (prenom.trim() !== (profil.prenom ?? '') || nom.trim() !== (profil.nom ?? ''));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Breadcrumbs items={[{ label: 'Mon profil' }]} />

      <header>
        <h2 className="text-2xl font-bold text-text">Mon profil</h2>
        <p className="mt-1 text-sm text-text-muted">
          Consultez vos informations et modifiez votre nom d’affichage.
        </p>
      </header>

      {profilQuery.isLoading && (
        <p className="text-sm text-text-muted">Chargement…</p>
      )}

      {profil && (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:items-start">
              <Avatar name={displayName} src={profil.url_avatar} size="lg" />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-lg font-semibold text-text">{displayName}</p>
                <p className="text-sm text-text-muted">{profil.email}</p>
                {profil.matricule && (
                  <p className="mt-1 text-xs text-text-muted">
                    Matricule {profil.matricule}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-text">Informations du compte</h3>
              <p className="text-xs text-text-muted">
                Seuls le prénom et le nom sont modifiables. L’avatar affiche vos
                initiales (photo de profil à venir).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoField label="Email" value={profil.email} />
                <InfoField
                  label="Matricule"
                  value={profil.matricule ?? '—'}
                />
                <InfoField label="Direction" value={directionLabel || '—'} />
                <InfoField
                  label="Fonction"
                  value={
                    profil.fonction
                      ? LIBELLES_FONCTION[profil.fonction as FonctionOrganisation]
                      : '—'
                  }
                />
                <InfoField label="Rôle" value={LIBELLES_ROLE[profil.role]} />
              </dl>

              <form
                className="space-y-3 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (modifie) modifierMut.mutate();
                }}
              >
                <h4 className="text-sm font-semibold text-text">
                  Modifier l’affichage
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-text-muted">
                      Prénom
                    </span>
                    <input
                      required
                      className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-text-muted">Nom</span>
                    <input
                      required
                      className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                    />
                  </label>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!modifie}
                  loading={modifierMut.isPending}
                >
                  Enregistrer
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
