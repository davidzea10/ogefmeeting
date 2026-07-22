import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { FormFeedback } from '@/components/motion/FormFeedback';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Tableau de bord', href: '/' },
          { label: 'Design system' },
        ]}
      />

      <div>
        <h2 className="text-2xl font-bold text-text">Design system OGEFREM</h2>
        <p className="text-text-muted">Palette bleu · jaune · blanc — composants de base</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Couleurs</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: 'Bleu', class: 'bg-ogefrem-blue' },
            { name: 'Jaune', class: 'bg-ogefrem-yellow' },
            { name: 'Navy', class: 'bg-ogefrem-navy' },
            { name: 'Blanc', class: 'bg-white border border-border' },
          ].map((c) => (
            <div key={c.name} className="space-y-2">
              <div className={`h-16 rounded-lg ${c.class}`} />
              <p className="text-sm font-medium">{c.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Boutons</h3>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Chargement</Button>
          <Button success>Succès</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Feedback formulaire</h3>
        <div className="max-w-md space-y-3">
          <FormFeedback message="Email ou mot de passe incorrect." shakeKey={1} />
          <FormFeedback type="success" message="Lien de réinitialisation envoyé." />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Badges</h3>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="yellow">Jaune</Badge>
          <Badge variant="success">Succès</Badge>
          <Badge variant="warning">Attention</Badge>
          <Badge variant="danger">Erreur</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Formulaire</h3>
        <Card>
          <CardHeader>
            <CardTitle>Exemple de champ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Email" placeholder="utilisateur@ogefrem.cd" hint="Votre email professionnel" />
            <Input label="Erreur" error="Ce champ est requis." defaultValue="" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Avatar</h3>
        <div className="flex gap-3">
          <Avatar name="David Debuze" size="sm" />
          <Avatar name="Secrétariat OGEFREM" size="md" />
          <Avatar name="Direction Générale" size="lg" />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Accessibilité (5.6)</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-text-muted">
          <li>Skip link clavier → contenu principal</li>
          <li>Contrastes WCAG AA (texte muted assombri)</li>
          <li>Cibles tactiles ≥ 44px sur mobile</li>
          <li>Focus trap + Escape sur le menu drawer</li>
          <li>Annonces lecteur d’écran (connexion / déconnexion)</li>
        </ul>
        <p className="text-sm text-text-muted">
          Détails : <code className="rounded bg-surface-muted px-1">docs/accessibility.md</code>
        </p>
      </section>
    </div>
  );
}
