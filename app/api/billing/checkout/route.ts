import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/firebase/admin";
import { stripe, vocaliseBranding } from "@/lib/stripe";
import { billingRef, getBilling } from "@/lib/billing";
import { CREDIT_PACKS, SUBSCRIPTION_PRICE } from "@/lib/pricing";

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
  const kind = body?.kind;
  const amount = Number(body?.amount);
  if (kind !== "subscription" && kind !== "credits") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (kind === "credits" && !CREDIT_PACKS.includes(amount)) {
    return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  try {
    // Client Stripe réutilisé d'un paiement à l'autre.
    const billing = await getBilling(uid);
    let customerId = billing.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email,
        metadata: { uid, app: "vocalise" },
      });
      customerId = customer.id;
      await billingRef(uid).set({ stripeCustomerId: customerId }, { merge: true });
    }

    const common = {
      customer: customerId,
      branding_settings: vocaliseBranding(origin),
      success_url: `${origin}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/billing`,
      locale: "fr" as const,
      metadata: { uid, app: "vocalise", kind, amount: String(amount || 0) },
    };

    const session =
      kind === "subscription"
        ? await stripe().checkout.sessions.create({
            ...common,
            mode: "subscription",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "eur",
                  unit_amount: Math.round(SUBSCRIPTION_PRICE * 100),
                  recurring: { interval: "month" },
                  product_data: { name: "Abonnement Vocalise" },
                },
              },
            ],
            subscription_data: { metadata: { uid, app: "vocalise" } },
          })
        : await stripe().checkout.sessions.create({
            ...common,
            mode: "payment",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "eur",
                  unit_amount: amount * 100,
                  product_data: { name: `Crédits Vocalise (${amount} €)` },
                },
              },
            ],
          });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout failed", error);
    return NextResponse.json({ error: "Impossible d'ouvrir le paiement." }, { status: 500 });
  }
}
