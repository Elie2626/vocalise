"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-bg)/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary) text-(--color-on-primary)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="18" x2="12" y2="22" />
            </svg>
          </span>
          Vocalise
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-2 sm:flex sm:gap-4">
          {loading ? null : user ? (
            <Link
              href="/app"
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover)"
            >
              Tableau de bord
            </Link>
          ) : (
            <>
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-2 text-sm font-medium text-(--color-foreground-muted) transition-colors hover:text-(--color-foreground)"
              >
                Tarifs
              </Link>

              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-(--color-foreground-muted) transition-colors hover:text-(--color-foreground)"
              >
                Connexion
              </Link>

              <Link
                href="/signup"
                className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover)"
              >
                Essayer gratuitement
              </Link>
            </>
          )}
        </nav>

        {/* Bouton mobile */}
        <button
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-lg sm:hidden"
          aria-label="Ouvrir le menu"
        >
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-(--color-border) bg-(--color-bg) sm:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4">
            {loading ? null : user ? (
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-(--color-primary) px-4 py-3 text-center text-sm font-medium text-(--color-on-primary)"
              >
                Tableau de bord
              </Link>
            ) : (
              <>
                <Link
                  href="/pricing"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium hover:bg-white/5"
                >
                  Tarifs
                </Link>

                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium hover:bg-white/5"
                >
                  Connexion
                </Link>

                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-(--color-primary) px-4 py-3 text-center text-sm font-medium text-(--color-on-primary)"
                >
                  Essayer gratuitement
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}