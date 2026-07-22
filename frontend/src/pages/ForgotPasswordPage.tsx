import { FormFeedback, SuccessCheck } from '@/components/motion/FormFeedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiMotDePasseOublie } from '@/lib/auth-api';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email.');
      setShakeKey((k) => k + 1);
      return;
    }

    setLoading(true);
    try {
      const msg = await apiMotDePasseOublie(email.trim());
      setMessage(msg);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <SuccessCheck label="Lien envoyé">
        <p className="max-w-sm text-sm text-text-muted">{message}</p>
        <Link
          to="/connexion"
          className="mt-2 text-sm font-semibold text-ogefrem-blue hover:underline"
        >
          Retour à la connexion
        </Link>
      </SuccessCheck>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold text-text">Mot de passe oublié</h2>
        <p className="text-sm text-text-muted">
          Saisissez votre email pour recevoir un lien de réinitialisation.
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

        {error && <FormFeedback message={error} shakeKey={shakeKey} />}

        <Button type="submit" className="w-full" loading={loading}>
          Envoyer le lien
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
