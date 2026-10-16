import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe";
import { getBilling, syncSubscription } from "@/lib/billing";

/** Annule (ou réactive) l'abonnement à la fin de la période payée. */
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
  const resume = body?.resume === true;

  const billing = await getBilling(uid);
  if (!billing.subscriptionId) {
    return NextResponse.json({ error: "Aucun abonnement." }, { status: 400 });
  }

  try {
    await stripe().subscriptions.update(billing.subscriptionId, {
      cancel_at_period_end: !resume,
    });
    const updated = await syncSubscription(uid, billing.subscriptionId);
    return NextResponse.json({ cancelAtPeriodEnd: updated.cancelAtPeriodEnd });
  } catch (error) {
    console.error("Cancel failed", error);
    return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
  }
}
