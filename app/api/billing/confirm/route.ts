import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe";
import { billingRef, creditOnce, syncSubscription } from "@/lib/billing";

/**
 * Appelée au retour du checkout (?session_id=...). Le serveur interroge Stripe
 * lui-même : on ne crédite jamais sur la seule parole du navigateur.
 */
export async function POST(request: NextRequest) {
  let uid: string;
  try {
    uid = await requireUid(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Session invalide." }, { status: 400 });
  }

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.uid !== uid || session.metadata?.app !== "vocalise") {
      return NextResponse.json({ error: "Session invalide." }, { status: 403 });
    }

    if (session.mode === "payment") {
      if (session.payment_status !== "paid") {
        return NextResponse.json({ status: "pending" });
      }
      const amount = (session.amount_total ?? 0) / 100;
      await creditOnce(uid, session.id, amount);
      return NextResponse.json({ status: "credited", amount });
    }

    if (session.mode === "subscription" && typeof session.subscription === "string") {
      await billingRef(uid).set({ subscriptionId: session.subscription }, { merge: true });
      const billing = await syncSubscription(uid, session.subscription);
      return NextResponse.json({ status: "subscribed", subscriptionStatus: billing.subscriptionStatus });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Confirm failed", error);
    return NextResponse.json({ error: "Vérification du paiement impossible." }, { status: 500 });
  }
}
