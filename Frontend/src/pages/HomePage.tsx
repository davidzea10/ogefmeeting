import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { StaggerItem, StaggerList } from '@/components/motion/StaggerList';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, HealthStatus } from '@ogefmeeting/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, FileText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? '';

async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_URL}/api/health`);
  const payload = (await response.json()) as ApiResponse<HealthStatus>;
  if (!payload.success) throw new Error(payload.error.message);
  return payload.data;
}

const sixI = [
  { letter: 'I', label: 'Intuitive', desc: 'Navigation claire, parcours évidents' },
  { letter: 'I', label: 'Innovante', desc: 'Interface moderne et fluide' },
  { letter: 'I', label: 'Impeccable', desc: 'Finitions soignées, zéro friction' },
  { letter: 'I', label: 'Interactive', desc: 'Micro-animations et feedback' },
  { letter: 'I', label: 'Inspirante', desc: 'Identité OGEFREM valorisée' },
  { letter: 'I', label: 'Intégrée', desc: 'Modules cohérents et unifiés' },
];

export function HomePage() {
  const profil = useAuthStore((s) => s.profil);
  const { data: health, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  const greeting = profil
    ? `Bonjour ${profil.prenom}`
    : 'Bienvenue sur Ogefmeeting';

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Breadcrumbs items={[{ label: 'Tableau de bord' }]} />

      <section className="relative overflow-hidden rounded-2xl gradient-ogefrem p-8 text-white shadow-lg">
        <img
          src="/brand/arriere-plan.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge variant="yellow" className="border-0">
              Étape 5 — Design system 6I
            </Badge>
            <h2 className="text-3xl font-bold">{greeting}</h2>
            <p className="max-w-2xl text-white/85">
              Plateforme de gestion et intelligence des réunions pour l&apos;Office de Gestion du
              Fret Multimodal.
            </p>
            {!profil && (
              <Link
                to="/connexion"
                className="inline-flex h-11 items-center rounded-lg bg-ogefrem-yellow px-5 text-sm font-semibold text-ogefrem-navy shadow-sm transition hover:bg-ogefrem-yellow-light"
              >
                Se connecter
              </Link>
            )}
          </div>
          <img
            src="/brand/logo-ogefrem.jpg"
            alt="Logo OGEFREM"
            className="h-24 w-auto self-start rounded-xl shadow-lg lg:self-center"
          />
        </div>
      </section>

      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            icon={Activity}
            title="API Backend"
            value={
              isLoading
                ? '...'
                : isError
                  ? 'Hors ligne'
                  : (health?.status.toUpperCase() ?? '—')
            }
            meta={health ? `v${health.version}` : 'Vérifiez le serveur'}
            ok={!isError && health?.status === 'ok'}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={Calendar} title="Réunions" value="—" meta="Module étape 6" />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={FileText} title="Comptes rendus" value="—" meta="Module étape 7+" />
        </StaggerItem>
      </StaggerList>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-ogefrem-yellow" />
          <h3 className="text-xl font-semibold text-text">Les 6I — Qualité perçue</h3>
        </div>
        <StaggerList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sixI.map((item) => (
            <StaggerItem key={item.label}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ogefrem-blue text-sm font-bold text-white">
                      {item.letter}
                    </span>
                    {item.label}
                  </CardTitle>
                  <CardDescription>{item.desc}</CardDescription>
                </CardHeader>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  meta,
  ok,
}: {
  icon: typeof Activity;
  title: string;
  value: string;
  meta: string;
  ok?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="rounded-lg bg-ogefrem-blue/10 p-3 text-ogefrem-blue">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-text-muted">{title}</p>
          <p className={`text-2xl font-bold ${ok ? 'text-success' : 'text-text'}`}>{value}</p>
          <p className="text-xs text-text-muted">{meta}</p>
        </div>
      </CardContent>
    </Card>
  );
}
