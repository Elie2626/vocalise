import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/firebase/admin";
import { stripe, vocaliseBranding } from "@/lib/stripe";
import { billingRef, freshBilling, productIdForPlan, syncSubscription } from "@/lib/billing";
import { getPlan } from "@/lib/pricing";

export async function POST(request: NextRequest) {
  let uid: string;
  let email: string | undefined;
  try {
    ({ uid, email } = await requireUser(request));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const plan = getPlan(body?.plan);
  if (!plan) {
    return NextResponse.json({ error: "Formule invalide." }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  try {
    const billing = await freshBilling(uid);
    const productId = await productIdForPlan(plan);
    const priceData = {
      currency: "eur",
      product: productId,
      unit_amount: Math.round(plan.price * 100),
      recurring: { interval: "month" as const },
    };

    // Déjà abonné : on change de formule sur l'abonnement existant (au prorata).
    const active =
      billing.subscriptionId &&
      (billing.subscriptionStatus === "active" || billing.subscriptionStatus === "trialing");
    if (active && billing.subscriptionId) {
      if (billing.plan === plan.id) {
        return NextResponse.json({ error: "Vous avez déjà cette formule." }, { status: 400 });
      }
      const sub = await stripe().subscriptions.retrieve(billing.subscriptionId);
      await stripe().subscriptions.update(billing.subscriptionId, {
        items: [{ id: sub.items.data[0].id, price_data: priceData }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata: { uid, app: "vocalise", plan: plan.id },
      });
      await syncSubscription(uid, billing.subscriptionId);
      return NextResponse.json({ changed: true, plan: plan.id });
    }

    // Client Stripe réutilisé d'un paiement à l'autre.
    let customerId = billing.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email,
        metadata: { uid, app: "vocalise" },
      });
      customerId = customer.id;
      await billingRef(uid).set({ stripeCustomerId: customerId }, { merge: true });
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      branding_settings: vocaliseBranding(origin),
      locale: "fr",
      line_items: [{ quantity: 1, price_data: priceData }],
      subscription_data: { metadata: { uid, app: "vocalise", plan: plan.id } },
      metadata: { uid, app: "vocalise", plan: plan.id },
      success_url: `${origin}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout failed", error);
    return NextResponse.json({ error: "Impossible d'ouvrir le paiement." }, { status: 500 });
  }
}
