"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth-context";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "settings", "account"));
        const list = snap.data()?.recipients;
        if (Array.isArray(list)) setRecipients(list.filter((r) => typeof r === "string"));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function persist(next: string[]) {
    if (!user) return;
    setSaving(true);
    setRecipients(next);
    try {
      await setDoc(
        doc(db, "users", user.uid, "settings", "account"),
        { recipients: next, updatedAt: Date.now() },
        { merge: true }
      );
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const email = input.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setError("Entrez une adresse email valide.");
      return;
    }
    if (recipients.includes(email)) {
      setError("Cette adresse est déjà dans la liste.");
      return;
    }
    if (recipients.length >= 10) {
      setError("Maximum 10 destinataires.");
      return;
    }
    setInput("");
    persist([...recipients, email]);
  }

  function handleRemove(email: string) {
    persist(recipients.filter((r) => r !== email));
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-medium text-(--color-primary) hover:underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Réglages</h1>

      <section className="mt-8 glass rounded-2xl p-6">
        <h2 className="font-semibold">Destinataires email</h2>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">
          Les adresses qui recevront vos transcriptions quand vous cliquez sur « Valider et
          envoyer ».
        </p>

        <form onSubmit={handleAdd} className="mt-5 flex flex-col gap-3 sm:flex-row" noValidate>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="adresse@exemple.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Adresse email à ajouter"
            className="min-w-0 flex-1 rounded-lg border border-(--color-border) bg-(--color-bg-elev) px-3 py-2.5 text-base outline-none focus:border-(--color-primary)"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 shrink-0 items-center justify-center rounded-lg bg-(--color-primary) px-5 text-sm font-semibold text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover) disabled:opacity-60"
          >
            Ajouter
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-(--color-error-bg) px-3 py-2 text-sm text-(--color-error)">
            {error}
          </p>
        )}

        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-(--color-foreground-muted)">Chargement…</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-(--color-foreground-muted)">Aucun destinataire pour le moment.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recipients.map((email) => (
                <li
                  key={email}
                  className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2.5"
                >
                  <span className="truncate text-sm">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(email)}
                    disabled={saving}
                    aria-label={`Supprimer ${email}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--color-foreground-muted) transition-colors hover:bg-(--color-error-bg) hover:text-(--color-error)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {savedAt && (
          <p className="mt-4 text-xs text-(--color-success)" aria-live="polite">
            Modifications enregistrées.
          </p>
        )}
      </section>
    </div>
  );
}
