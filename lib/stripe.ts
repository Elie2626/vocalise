import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Construit le client à la demande (pas de clé requise au build). */
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
    client = new Stripe(key);
  }
  return client;
}

/**
 * Habillage du checkout : le compte Stripe s'appelle « Amarflow », mais on
 * affiche « Vocalise » uniquement sur les paiements de cette app (réglage par
 * session, les autres paiements du compte ne sont pas touchés).
 */
export function vocaliseBranding(origin: string): Stripe.Checkout.SessionCreateParams.BrandingSettings {
  return {
    display_name: "Vocalise",
    icon: { type: "url", url: `${origin}/icon.png` },
    button_color: "#1e5b4a",
  };
}
