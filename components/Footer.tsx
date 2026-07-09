export function Footer() {
  return (
    <footer className="border-t border-(--color-border) py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-sm text-(--color-foreground-muted) sm:flex-row sm:justify-between sm:px-6">
        <p>&copy; {new Date().getFullYear()} Vocalise. Tous droits réservés.</p>
        <p>Transcription propulsée par l&apos;IA.</p>
      </div>
    </footer>
  );
}
