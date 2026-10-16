"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth-context";
import { PLANS, getPlan, formatEuro, formatMinutes, type PlanId } from "@/lib/pricing";

interface BillingDoc {
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  plan?: PlanId | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  minutesUsed?: number;
  usagePeriodEnd?: number | null;
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

  async function choosePlan(planId: PlanId) {
    const data = await call("/api/billing/checkout", { plan: planId }, planId);
    if (data?.url) window.location.assign(data.url);
    else if (data?.changed)
      setMessage({ kind: "ok", text: `Formule changée pour ${getPlan(planId)?.name}.` });
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
  const currentPlan = active ? getPlan(billing?.plan) : undefined;
  const used =
    billing?.usagePeriodEnd && billing.usagePeriodEnd === billing.currentPeriodEnd
      ? billing.minutesUsed ?? 0
      : 0;
  const periodEnd = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString("fr-FR")
    : null;
  const usedPct = currentPlan ? Math.min(100, (used / currentPlan.includedMinutes) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app" className="text-sm font-medium text-(--color-primary) hover:underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Abonnement</h1>

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

      {currentPlan && (
        <section className="glass mt-6 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-(--color-foreground-muted)">Formule actuelle</p>
              <p className="mt-1 text-xl font-semibold">
                {currentPlan.name} · {formatEuro(currentPlan.price)}/mois
              </p>
              <p className="mt-1 text-xs text-(--color-foreground-muted)">
                {billing?.cancelAtPeriodEnd
                  ? `Se termine le ${periodEnd}`
                  : `Renouvellement le ${periodEnd}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleCancel(Boolean(billing?.cancelAtPeriodEnd))}
              disabled={busy !== null}
              className="flex h-11 items-center rounded-lg border border-(--color-border) px-4 text-sm font-medium transition-colors hover:bg-(--color-bg) disabled:opacity-60"
            >
              {billing?.cancelAtPeriodEnd ? "Réactiver" : "Annuler l'abonnement"}
            </button>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-sm">
              <span>Utilisé ce mois-ci</span>
              <span className="tabular-nums">
                {formatMinutes(used)} / {formatMinutes(currentPlan.includedMinutes)}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-(--color-border)"
              role="progressbar"
              aria-valuenow={Math.round(usedPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Quota utilisé"
            >
              <div className="h-full rounded-full bg-(--color-primary)" style={{ width: `${usedPct}%` }} />
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          return (
            <section
              key={plan.id}
              className={`${plan.highlighted ? "glass-strong" : "glass"} relative flex flex-col rounded-2xl p-6`}
            >
              {plan.highlighted && (
                <span className="absolute right-5 top-5 rounded-full bg-(--color-primary) px-2.5 py-0.5 text-xs font-semibold text-(--color-on-primary)">
                  Populaire
                </span>
              )}
              <h2 className="font-semibold">{plan.name}</h2>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums">{formatEuro(plan.price)}</span>
                <span className="text-sm text-(--color-foreground-muted)">/ mois</span>
              </p>
              <p className="mt-2 text-sm font-medium">
                {formatMinutes(plan.includedMinutes)} de transcription / mois
              </p>
              <p className="mt-1 flex-1 text-sm text-(--color-foreground-muted)">{plan.tagline}</p>
              <button
                type="button"
                onClick={() => choosePlan(plan.id)}
                disabled={busy !== null || isCurrent}
                className={`mt-5 flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  plan.highlighted
                    ? "bg-(--color-primary) text-(--color-on-primary) hover:bg-(--color-primary-hover)"
                    : "border border-(--color-border) hover:bg-(--color-bg)"
                }`}
              >
                {isCurrent
                  ? "Formule actuelle"
                  : busy === plan.id
                    ? "Ouverture…"
                    : currentPlan
                      ? "Changer pour celle-ci"
                      : "S'abonner"}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
