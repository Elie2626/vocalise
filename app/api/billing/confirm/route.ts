import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe";
import { billingRef, syncSubscription } from "@/lib/billing";

/**
 * Appelée au retour du checkout (?session_id=...). Le serveur interroge Stripe
 * lui-même : on n'active jamais un abonnement sur la seule parole du navigateur.
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
    if (session.mode === "subscription" && typeof session.subscription === "string") {
      await billingRef(uid).set({ subscriptionId: session.subscription }, { merge: true });
      const billing = await syncSubscription(uid, session.subscription);
      return NextResponse.json({ status: "subscribed", plan: billing.plan });
    }
    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Confirm failed", error);
    return NextResponse.json({ error: "Vérification du paiement impossible." }, { status: 500 });
  }
}
