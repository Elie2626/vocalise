import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe";
import {
  apiCostForMinutes,
  usagePriceForMinutes,
  SUBSCRIPTION_INCLUDED_API_BUDGET,
} from "@/lib/pricing";

export interface BillingAccount {
  credits: number;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  /** Fin de la période en cours (ms). */
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  subscriptionCheckedAt?: number | null;
}

export function billingRef(uid: string) {
  return adminDb().collection("users").doc(uid).collection("billing").doc("account");
}

export function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getBilling(uid: string): Promise<BillingAccount> {
  const snap = await billingRef(uid).get();
  const d = snap.data() ?? {};
  return { credits: typeof d.credits === "number" ? d.credits : 0, ...d } as BillingAccount;
}

function periodEndMs(sub: { items?: { data?: { current_period_end?: number }[] } } & Record<string, unknown>): number | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  const topEnd = typeof sub.current_period_end === "number" ? (sub.current_period_end as number) : undefined;
  const end = itemEnd ?? topEnd;
  return end ? end * 1000 : null;
}

/** Synchronise l'état de l'abonnement depuis Stripe (sans webhook). */
export async function syncSubscription(uid: string, subscriptionId: string): Promise<BillingAccount> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  await billingRef(uid).set(
    {
      subscriptionId: sub.id,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEndMs(sub as unknown as Parameters<typeof periodEndMs>[0]),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      subscriptionCheckedAt: Date.now(),
    },
    { merge: true }
  );
  return getBilling(uid);
}

/** Abonnement actif, en rafraîchissant depuis Stripe si l'info est vieille (>1h) ou périmée. */
export async function hasActiveSubscription(uid: string, billing: BillingAccount): Promise<boolean> {
  if (!billing.subscriptionId) return false;
  const stale =
    !billing.subscriptionCheckedAt ||
    Date.now() - billing.subscriptionCheckedAt > 60 * 60 * 1000 ||
    (billing.currentPeriodEnd ?? 0) < Date.now();
  let b = billing;
  if (stale) {
    try {
      b = await syncSubscription(uid, billing.subscriptionId);
    } catch {
      // Stripe injoignable : on se fie au dernier état connu.
    }
  }
  return (
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") &&
    (b.currentPeriodEnd ?? 0) > Date.now()
  );
}

async function monthApiCost(uid: string): Promise<number> {
  const snap = await adminDb()
    .collection("users")
    .doc(uid)
    .collection("usage")
    .doc(currentPeriodKey())
    .get();
  const v = snap.data()?.apiCost;
  return typeof v === "number" ? v : 0;
}

export type Coverage =
  | { ok: true; via: "subscription"; charge: 0 }
  | { ok: true; via: "credits"; charge: number }
  | { ok: false; reason: "insufficient"; charge: number; credits: number };

/**
 * Décide comment une transcription de `durationSeconds` est payée :
 * 1. abonnement actif et quota du mois (9 € de coût API) non atteint → inclus ;
 * 2. sinon crédits prépayés (0,015 €/min) → doit couvrir le prix.
 */
export async function decideCoverage(uid: string, durationSeconds: number): Promise<Coverage> {
  const billing = await getBilling(uid);
  const minutes = durationSeconds / 60;

  if (await hasActiveSubscription(uid, billing)) {
    const spent = await monthApiCost(uid);
    if (spent < SUBSCRIPTION_INCLUDED_API_BUDGET) {
      return { ok: true, via: "subscription", charge: 0 };
    }
  }

  const charge = Math.round(usagePriceForMinutes(minutes) * 10000) / 10000;
  if (billing.credits >= charge) return { ok: true, via: "credits", charge };
  return { ok: false, reason: "insufficient", charge, credits: billing.credits };
}

/** Débite les crédits après une transcription réussie (transaction). */
export async function debitCredits(uid: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const ref = billingRef(uid);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const credits = typeof snap.data()?.credits === "number" ? snap.data()!.credits : 0;
    tx.set(ref, { credits: Math.max(0, credits - amount) }, { merge: true });
  });
}

/** Coût API pour le suivi d'usage (réexport pratique). */
export { apiCostForMinutes };

/** Crédite le compte une seule fois par session Stripe (idempotent). */
export async function creditOnce(uid: string, sessionId: string, amount: number): Promise<boolean> {
  const paymentRef = adminDb().collection("users").doc(uid).collection("payments").doc(sessionId);
  const ref = billingRef(uid);
  return adminDb().runTransaction(async (tx) => {
    const existing = await tx.get(paymentRef);
    if (existing.exists) return false;
    tx.set(paymentRef, { kind: "credits", amount, at: Date.now() });
    tx.set(ref, { credits: FieldValue.increment(amount) }, { merge: true });
    return true;
  });
}
