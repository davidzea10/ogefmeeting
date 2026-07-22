import { FormFeedback, SuccessCheck } from '@/components/motion/FormFeedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiConnexion } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Première connexion après invitation admin.
 * L'utilisateur se connecte avec l'email + mot de passe temporaire,
 * puis peut définir un nouveau mot de passe (redirect vers reset).
 */
export function InvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Renseignez l’email et le mot de passe temporaire reçu.');
      setShakeKey((k) => k + 1);
      return;
    }

    setLoading(true);
    try {
      const session = await apiConnexion(email.trim(), password);
      setSession(session);
      setActivated(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Identifiants invalides. Vérifiez l’email d’invitation.',
      );
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  if (activated) {
    return (
      <SuccessCheck label="Compte activé">
        <p className="max-w-sm text-sm text-text-muted">
          Bienvenue dans Ogefmeeting. Pour votre sécurité, choisissez un nouveau mot de passe.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => navigate('/reinitialiser-mot-de-passe')}>
            Changer mon mot de passe
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            Continuer
          </Button>
        </div>
      </SuccessCheck>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-text">Activer mon compte</h2>
        <p className="text-sm text-text-muted">
          Première connexion avec les identifiants reçus par email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          label="Mot de passe temporaire"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Fourni dans l’email d’invitation"
          required
        />

        {error && <FormFeedback message={error} shakeKey={shakeKey} />}

        <Button type="submit" className="w-full" loading={loading}>
          Activer mon compte
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        Déjà activé ?{' '}
        <Link to="/connexion" className="font-medium text-ogefrem-blue hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
