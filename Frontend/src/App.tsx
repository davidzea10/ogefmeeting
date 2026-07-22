import { useEffect, useState } from 'react';
import './App.css';
import type { ApiResponse, HealthStatus } from '@ogefmeeting/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        const payload = (await response.json()) as ApiResponse<HealthStatus>;

        if (!payload.success) {
          setError(payload.error.message);
          return;
        }

        setHealth(payload.data);
      } catch {
        setError("Impossible de joindre l'API backend.");
      } finally {
        setLoading(false);
      }
    }

    void fetchHealth();
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">OM</span>
          <div>
            <p className="brand-kicker">OGEFREM</p>
            <h1>Ogefmeeting</h1>
          </div>
        </div>
        <span className="badge">Étape 2 — Base de données</span>
      </header>

      <main className="main">
        <section className="hero-card">
          <p className="eyebrow">Application web de réunions</p>
          <h2>Gestion intelligente des réunions de direction</h2>
          <p className="lead">
            Plateforme moderne pour planifier, conduire, documenter et archiver les réunions de
            l&apos;Office de Gestion du Fret Multimodal.
          </p>
        </section>

        <section className="status-grid">
          <article className="status-card">
            <h3>Frontend</h3>
            <p className="status-value ok">React + Vite</p>
            <p className="status-meta">Interface prête pour le design system 6I</p>
          </article>

          <article className="status-card">
            <h3>Backend API</h3>
            {loading && <p className="status-value">Vérification...</p>}
            {!loading && error && <p className="status-value error">{error}</p>}
            {!loading && health && (
              <>
                <p className="status-value ok">{health.status.toUpperCase()}</p>
                <p className="status-meta">
                  v{health.version} · {health.environment}
                </p>
              </>
            )}
          </article>

          <article className="status-card">
            <h3>Supabase</h3>
            {loading && <p className="status-value">Vérification...</p>}
            {!loading && health?.supabase === 'connected' && (
              <>
                <p className="status-value ok">Connecté</p>
                <p className="status-meta">
                  {health.database?.directions ?? 0} directions ·{' '}
                  {health.database?.templates ?? 0} modèles CR
                </p>
              </>
            )}
            {!loading && health?.supabase === 'configured' && (
              <>
                <p className="status-value pending">Configuré</p>
                <p className="status-meta">Exécutez les migrations SQL</p>
              </>
            )}
            {!loading && health?.supabase === 'error' && (
              <>
                <p className="status-value error">Erreur</p>
                <p className="status-meta">Migrations non appliquées ?</p>
              </>
            )}
            {!loading && (!health || health.supabase === 'not_configured') && (
              <>
                <p className="status-value pending">À configurer</p>
                <p className="status-meta">Voir docs/supabase-setup.md</p>
              </>
            )}
          </article>
        </section>
      </main>

      <footer className="footer">
        <p>Ogefmeeting · OGEFREM · Kinshasa</p>
      </footer>
    </div>
  );
}

export default App;
