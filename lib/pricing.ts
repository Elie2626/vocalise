// Source unique de vérité pour la tarification.
// Tout est exprimé en euros.

/** Coût API estimé supporté par Vocalise, par minute d'audio transcrite. */
export const API_COST_PER_MINUTE = 0.006;

/** Marge appliquée au coût API pour le prix à l'utilisation. */
export const USAGE_MARKUP = 1.5;

/** Prix facturé à l'utilisateur, par minute (paiement à l'utilisation). */
export const USAGE_PRICE_PER_MINUTE = API_COST_PER_MINUTE * USAGE_MARKUP; // 0,009 €/min

/** Abonnement mensuel. */
export const SUBSCRIPTION_PRICE = 9.99;

/** Budget de coût API inclus dans l'abonnement, par mois. */
export const SUBSCRIPTION_INCLUDED_API_BUDGET = 9;

/** Minutes incluses dans l'abonnement (dérivé du budget API). */
export const SUBSCRIPTION_INCLUDED_MINUTES = Math.round(
  SUBSCRIPTION_INCLUDED_API_BUDGET / API_COST_PER_MINUTE
); // 1500 min = 25 h

/** Minutes offertes à l'inscription (essai gratuit). */
export const FREE_TRIAL_MINUTES = 15;

/** Prix à l'utilisation pour une durée donnée (en minutes). */
export function usagePriceForMinutes(minutes: number): number {
  return minutes * USAGE_PRICE_PER_MINUTE;
}

/** Coût API estimé d'une transcription (pour le suivi d'usage / la limite abonné). */
export function apiCostForMinutes(minutes: number): number {
  return minutes * API_COST_PER_MINUTE;
}

/** Formate un prix en euros, ex: 0,54 €. Précision adaptée aux très petits montants. */
export function formatEuro(amount: number): string {
  const decimals = amount > 0 && amount < 0.1 ? 3 : 2;
  return `${amount.toFixed(decimals).replace(".", ",")} €`;
}

export interface UsageTableRow {
  label: string;
  minutes: number;
  price: number;
}

/** Lignes du tableau « à l'utilisation » affiché sur la page de tarifs. */
export const USAGE_TABLE: UsageTableRow[] = [
  { label: "1 minute", minutes: 1 },
  { label: "10 minutes", minutes: 10 },
  { label: "1 heure", minutes: 60 },
  { label: "24 heures", minutes: 24 * 60 },
].map((r) => ({ ...r, price: usagePriceForMinutes(r.minutes) }));
