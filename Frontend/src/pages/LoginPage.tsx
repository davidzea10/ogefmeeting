import { useAnnouncerStore } from '@/components/a11y/LiveAnnouncer';
import { FormFeedback } from '@/components/motion/FormFeedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiConnexion } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const announce = useAnnouncerStore((s) => s.announce);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      setShakeKey((k) => k + 1);
      return;
    }

    setLoading(true);
    try {
      const session = await apiConnexion(email.trim(), password);
      setSession(session);
      announce(`Connexion réussie. Bienvenue ${session.profil?.prenom ?? ''}.`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-text">Connexion</h2>
        <p className="text-sm text-text-muted">Accédez à votre espace Ogefmeeting</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
        aria-label="Formulaire de connexion"
      >
        <Input
          label="Adresse email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nom@ogefrem.cd"
          required
        />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <FormFeedback message={error} shakeKey={shakeKey} />}

        <Button type="submit" className="w-full" loading={loading}>
          Se connecter
        </Button>
      </form>

      <div className="space-y-2 text-center text-sm text-text-muted">
        <p>
          <Link
            to="/mot-de-passe-oublie"
            className="font-medium text-ogefrem-blue underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ogefrem-blue"
          >
            Mot de passe oublié ?
          </Link>
        </p>
        <p>
          Première connexion ?{' '}
          <Link
            to="/invitation"
            className="font-medium text-ogefrem-blue underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ogefrem-blue"
          >
            Activer mon compte
          </Link>
        </p>
      </div>
    </div>
  );
}
