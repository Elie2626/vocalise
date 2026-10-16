"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth-context";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_INCLUDED_MINUTES,
  USAGE_PRICE_PER_MINUTE,
  formatEuro,
} from "@/lib/pricing";

interface BillingDoc {
  credits?: number;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <Billing />
    </Suspense>
  );
}

function Billing() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [billing, setBilling] = useState<BillingDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const confirmedRef = useRef(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid, "billing", "account"), (snap) => {
      setBilling((snap.data() as BillingDoc) ?? {});
    });
  }, [user]);

  // Retour du checkout Stripe : le serveur vérifie le paiement.
  useEffect(() => {
    if (!user || !sessionId || confirmedRef.current) return;
    confirmedRef.current = true;
    (async () => {
      setBusy("confirm");
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setMessage({ kind: "error", text: data.error ?? "Vérification impossible." });
        else if (data.status === "credited")
          setMessage({ kind: "ok", text: `Paiement reçu : ${formatEuro(data.amount)} ajoutés à votre solde.` });
        else if (data.status === "subscribed")
          setMessage({ kind: "ok", text: "Abonnement activé. Merci !" });
        else setMessage({ kind: "ok", text: "Paiement en cours de validation…" });
      } finally {
        setBusy(null);
        router.replace("/app/billing");
      }
    })();
  }, [user, sessionId, router]);

  async function call(path: string, body: unknown, key: string) {
    if (!user) return null;
    setBusy(key);
    setMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error ?? "Une erreur est survenue." });
        return null;
      }
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function checkout(kind: "subscription" | "credits", amount?: number) {
    const data = await call("/api/billing/checkout", { kind, amount }, `${kind}-${amount ?? ""}`);
    if (data?.url) window.location.href = data.url;
  }

  async function toggleCancel(resume: boolean) {
    const data = await call("/api/billing/cancel", { resume }, "cancel");
    if (data)
      setMessage({
        kind: "ok",
        text: resume ? "Abonnement réactivé." : "L'abonnement s'arrêtera à la fin de la période payée.",
      });
  }

  if (!user) return null;

  const active =
    (billing?.subscriptionStatus === "active" || billing?.subscriptionStatus === "trialing") &&
    (billing?.currentPeriodEnd ?? 0) > now;
  const periodEnd = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString("fr-FR")
    : null;
  const includedHours = Math.round(SUBSCRIPTION_INCLUDED_MINUTES / 60);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app" className="text-sm font-medium text-(--color-primary) hover:underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Facturation</h1>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-5 rounded-lg px-3 py-2 text-sm ${
            message.kind === "error"
              ? "bg-(--color-error-bg) text-(--color-error)"
              : "bg-(--color-success-bg) text-(--color-success)"
          }`}
        >
          {message.text}
        </p>
      )}
      {busy === "confirm" && (
        <p role="status" className="mt-5 text-sm text-(--color-foreground-muted)">
          Vérification du paiement…
        </p>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-medium text-(--color-foreground-muted)">Solde de crédits</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {billing ? formatEuro(billing.credits ?? 0) : "—"}
          </p>
          <p className="mt-1 text-xs text-(--color-foreground-muted)">
            {formatEuro(USAGE_PRICE_PER_MINUTE)} par minute transcrite
          </p>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-medium text-(--color-foreground-muted)">Abonnement</h2>
          {active ? (
            <>
              <p className="mt-2 text-lg font-semibold text-(--color-success)">Actif</p>
              <p className="mt-1 text-xs text-(--color-foreground-muted)">
                {billing?.cancelAtPeriodEnd
                  ? `Se termine le ${periodEnd}`
                  : `Renouvellement le ${periodEnd}`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg font-semibold">Aucun</p>
          )}
        </section>
      </div>

      <section className="glass-strong mt-6 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Abonnement {formatEuro(SUBSCRIPTION_PRICE)} / mois</h2>
            <p className="mt-1 text-sm text-(--color-foreground-muted)">
              {includedHours} h de transcription incluses par mois. Au-delà, vos crédits prennent
              le relais.
            </p>
          </div>
          {active ? (
            <button
              type="button"
              onClick={() => toggleCancel(Boolean(billing?.cancelAtPeriodEnd))}
              disabled={busy !== null}
              className="flex h-11 items-center rounded-lg border border-(--color-border) px-4 text-sm font-medium transition-colors hover:bg-(--color-bg) disabled:opacity-60"
            >
              {billing?.cancelAtPeriodEnd ? "Réactiver" : "Annuler l'abonnement"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => checkout("subscription")}
              disabled={busy !== null}
              className="flex h-11 items-center rounded-lg bg-(--color-primary) px-5 text-sm font-semibold text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover) disabled:opacity-60"
            >
              {busy === "subscription-" ? "Ouverture…" : "S'abonner"}
            </button>
          )}
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="font-semibold">Recharger des crédits</h2>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">
          Sans engagement, utilisables à tout moment.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CREDIT_PACKS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => checkout("credits", amount)}
              disabled={busy !== null}
              className="flex h-14 flex-col items-center justify-center rounded-xl border border-(--color-border) text-sm transition-colors hover:border-(--color-primary) disabled:opacity-60"
            >
              <span className="font-semibold tabular-nums">{amount} €</span>
              <span className="text-xs text-(--color-foreground-muted)">
                ≈ {Math.floor(amount / USAGE_PRICE_PER_MINUTE / 60)} h
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
