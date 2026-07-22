export function AppFooter() {
  return (
    <footer
      className="mt-auto border-t border-border bg-surface px-4 py-4 sm:px-6"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center text-sm text-text-muted sm:flex-row sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <img
            src="/brand/logo-ogefrem.jpg"
            alt="Logo OGEFREM"
            className="h-8 w-auto rounded object-contain"
          />
          <span>Office de Gestion du Fret Multimodal · Kinshasa, RDC</span>
        </div>
        <p>Ogefmeeting v0.1.0 · © {new Date().getFullYear()} OGEFREM</p>
      </div>
    </footer>
  );
}
