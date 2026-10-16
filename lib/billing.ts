import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe";
import { getPlan, PLANS, type Plan, type PlanId } from "@/lib/pricing";

export interface BillingAccount {
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  plan?: PlanId | null;
  /** Fin de la période en cours (ms). */
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  subscriptionCheckedAt?: number | null;
  /** Minutes consommées sur la période `usagePeriodEnd`. */
  minutesUsed?: number;
  usagePeriodEnd?: number | null;
}

export function billingRef(uid: string) {
  return adminDb().collection("users").doc(uid).collection("billing").doc("account");
}

export async function getBilling(uid: string): Promise<BillingAccount> {
  const snap = await billingRef(uid).get();
  return (snap.data() ?? {}) as BillingAccount;
}

type SubLike = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: { current_period_end?: number; price?: { unit_amount?: number | null } }[] };
};

function periodEndMs(sub: SubLike): number | null {
  const end = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  return end ? end * 1000 : null;
}

/** Formule d'après les métadonnées, sinon d'après le prix facturé. */
function planFromSub(sub: SubLike): PlanId | null {
  const fromMeta = getPlan(sub.metadata?.plan);
  if (fromMeta) return fromMeta.id;
  const cents = sub.items?.data?.[0]?.price?.unit_amount;
  return PLANS.find((p) => Math.round(p.price * 100) === cents)?.id ?? null;
}

/** Synchronise l'état de l'abonnement depuis Stripe (sans webhook). */
export async function syncSubscription(uid: string, subscriptionId: string): Promise<BillingAccount> {
  const sub = (await stripe().subscriptions.retrieve(subscriptionId)) as unknown as SubLike;
  await billingRef(uid).set(
    {
      subscriptionId: sub.id,
      subscriptionStatus: sub.status,
      plan: planFromSub(sub),
      currentPeriodEnd: periodEndMs(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      subscriptionCheckedAt: Date.now(),
    },
    { merge: true }
  );
  return getBilling(uid);
}

function isActive(b: BillingAccount): boolean {
  return (
    (b.subscriptionStatus === "active" || b.subscriptionStatus === "trialing") &&
    (b.currentPeriodEnd ?? 0) > Date.now()
  );
}

/** État d'abonnement à jour (rafraîchi depuis Stripe si vieux de >1h ou période échue). */
export async function freshBilling(uid: string): Promise<BillingAccount> {
  const b = await getBilling(uid);
  if (!b.subscriptionId) return b;
  const stale =
    !b.subscriptionCheckedAt ||
    Date.now() - b.subscriptionCheckedAt > 60 * 60 * 1000 ||
    (b.currentPeriodEnd ?? 0) < Date.now();
  if (!stale) return b;
  try {
    return await syncSubscription(uid, b.subscriptionId);
  } catch {
    return b; // Stripe injoignable : dernier état connu.
  }
}

/** Minutes utilisées sur la période en cours (remise à zéro à chaque renouvellement). */
export function minutesUsedThisPeriod(b: BillingAccount): number {
  return b.usagePeriodEnd && b.usagePeriodEnd === b.currentPeriodEnd ? (b.minutesUsed ?? 0) : 0;
}

export type Coverage =
  | { ok: true; plan: Plan }
  | { ok: false; reason: "no_subscription" }
  | { ok: false; reason: "quota"; plan: Plan; remainingMinutes: number };

/** Une transcription de `durationSeconds` est-elle couverte par l'abonnement ? */
export async function decideCoverage(uid: string, durationSeconds: number): Promise<Coverage> {
  const b = await freshBilling(uid);
  const plan = getPlan(b.plan);
  if (!isActive(b) || !plan) return { ok: false, reason: "no_subscription" };

  const remaining = plan.includedMinutes - minutesUsedThisPeriod(b);
  if (durationSeconds / 60 > remaining) {
    return { ok: false, reason: "quota", plan, remainingMinutes: Math.max(0, remaining) };
  }
  return { ok: true, plan };
}

/** Ajoute les minutes consommées à la période en cours (transaction). */
export async function addMinutesUsed(uid: string, minutes: number): Promise<void> {
  const ref = billingRef(uid);
  await adminDb().runTransaction(async (tx) => {
    const b = ((await tx.get(ref)).data() ?? {}) as BillingAccount;
    const used = minutesUsedThisPeriod(b);
    tx.set(
      ref,
      { minutesUsed: used + minutes, usagePeriodEnd: b.currentPeriodEnd ?? null },
      { merge: true }
    );
  });
}

/**
 * Produit Stripe de chaque formule, créé une seule fois puis mis en cache
 * (les produits « Vocalise Essentiel/Pro/Business » apparaissent ainsi dans
 * le catalogue Stripe).
 */
export async function productIdForPlan(plan: Plan): Promise<string> {
  const ref = adminDb().collection("app").doc("stripe");
  const cached = (await ref.get()).data()?.[`product_${plan.id}`];
  if (typeof cached === "string") return cached;
  const product = await stripe().products.create({
    name: `Vocalise ${plan.name}`,
    description: `${Math.round(plan.includedMinutes / 60)} h de transcription par mois`,
    metadata: { app: "vocalise", plan: plan.id },
  });
  await ref.set({ [`product_${plan.id}`]: product.id }, { merge: true });
  return product.id;
}
