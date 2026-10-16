// Source unique de vérité pour la tarification. Tout est en euros.

// Coût API réel ≈ 0,012 €/min (gpt-4o-transcribe + Whisper pour l'horodatage
// + passes GPT). Sert au suivi d'usage interne.
/** Coût API estimé par minute d'audio. */
export const API_COST_PER_MINUTE = 0.012;

export type PlanId = "essentiel" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  /** Prix mensuel TTC. */
  price: number;
  /** Minutes de transcription incluses par période d'abonnement. */
  includedMinutes: number;
  tagline: string;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: 10,
    includedMinutes: 6 * 60,
    tagline: "Pour un usage personnel régulier.",
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    includedMinutes: 12 * 60,
    tagline: "Pour les professionnels qui transcrivent chaque jour.",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: 49,
    includedMinutes: 35 * 60,
    tagline: "Pour les gros volumes et les équipes.",
  },
];

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Coût API estimé d'une transcription (suivi d'usage interne). */
export function apiCostForMinutes(minutes: number): number {
  return minutes * API_COST_PER_MINUTE;
}

/** Formate un prix en euros, ex: 19 € ou 9,99 €. */
export function formatEuro(amount: number): string {
  const s = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${s.replace(".", ",")} €`;
}

/** Formate une durée en minutes, ex: 6 h, 1 h 30, 45 min. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, "0")}`;
}
