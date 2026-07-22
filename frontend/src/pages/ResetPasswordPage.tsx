import { FormFeedback, SuccessCheck } from '@/components/motion/FormFeedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiChangerMotDePasse } from '@/lib/auth-api';
import { useAuthStore } from '@/stores/auth.store';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

/**
 * Page de réinitialisation après clic sur le lien email Supabase.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const tokenFromUrl = searchParams.get('access_token') ?? accessToken;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      setShakeKey((k) => k + 1);
      return;
    }

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      setShakeKey((k) => k + 1);
      return;
    }

    if (!tokenFromUrl) {
      setError(
        'Lien invalide ou expiré. Demandez un nouveau lien depuis « Mot de passe oublié ».',
      );
      setShakeKey((k) => k + 1);
      return;
    }

    setLoading(true);
    try {
      await apiChangerMotDePasse(tokenFromUrl, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible.');
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SuccessCheck label="Mot de passe mis à jour">
        <p className="text-sm text-text-muted">Vous pouvez maintenant vous connecter.</p>
        <Link
          to="/connexion"
          className="mt-2 text-sm font-semibold text-ogefrem-blue hover:underline"
        >
          Se connecter
        </Link>
      </SuccessCheck>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-text">Nouveau mot de passe</h2>
        <p className="text-sm text-text-muted">
          Choisissez un mot de passe sécurisé (8 caractères minimum).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {error && <FormFeedback message={error} shakeKey={shakeKey} />}

        <Button type="submit" className="w-full" loading={loading}>
          Enregistrer
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        <Link to="/connexion" className="font-medium text-ogefrem-blue hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
