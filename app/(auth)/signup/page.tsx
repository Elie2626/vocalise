"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firebaseAuthErrorMessage } from "@/lib/firebase-errors";
import { PasswordInput, GoogleIcon } from "@/components/PasswordInput";

export default function SignupPage() {
  const { signup, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password, name);
      router.push("/app");
    } catch (err) {
      setError(firebaseAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      router.push("/app");
    } catch (err) {
      setError(firebaseAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-strong rounded-2xl p-8">
      <h1 className="text-xl font-semibold">Créer un compte</h1>
      <p className="mt-1 text-sm text-(--color-foreground-muted)">
        Commencez à transcrire vos vocaux et vidéos gratuitement.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Nom
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg-elev) px-3 py-2.5 text-base outline-none focus:border-(--color-primary)"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-bg-elev) px-3 py-2.5 text-base outline-none focus:border-(--color-primary)"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Mot de passe <span aria-hidden>*</span>
            <span className="sr-only">obligatoire</span>
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <p className="text-xs text-(--color-foreground-muted)">Au moins 6 caractères.</p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-(--color-error-bg) px-3 py-2 text-sm text-(--color-error)"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex h-11 items-center justify-center rounded-lg bg-(--color-primary) px-4 text-sm font-medium text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover) disabled:opacity-60"
        >
          {submitting ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-(--color-foreground-muted)">
        <span className="h-px flex-1 bg-(--color-border)" />
        ou
        <span className="h-px flex-1 bg-(--color-border)" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-(--color-border) text-sm font-medium transition-colors hover:bg-(--color-bg) disabled:opacity-60"
      >
        <GoogleIcon />
        Continuer avec Google
      </button>

      <p className="mt-6 text-center text-sm text-(--color-foreground-muted)">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-(--color-primary) hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
