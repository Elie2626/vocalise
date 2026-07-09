"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span
          aria-label="Chargement"
          className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-bg)/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/app" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary) text-(--color-on-primary)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </span>
            Vocalise
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-(--color-foreground-muted) sm:inline">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => logout().then(() => router.push("/"))}
              className="rounded-lg border border-(--color-border) px-3 py-2 text-sm font-medium transition-colors hover:bg-(--color-bg)"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
