/**
 * Lien « Aller au contenu » — visible au focus clavier uniquement (WCAG 2.4.1).
 */
export function SkipLink() {
  return (
    <a href="#contenu-principal" className="skip-link">
      Aller au contenu principal
    </a>
  );
}
