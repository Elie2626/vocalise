import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PLANS, formatEuro, formatMinutes } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Tarifs — Vocalise",
  description:
    "Trois abonnements mensuels sans engagement : Essentiel, Pro et Business. Choisissez la formule Vocalise qui vous convient.",
};

const COMMON_FEATURES = [
  "Résumé automatique et horodatage",
  "Détection & traduction multilingue",
  "Schémas logiques",
  "Export .pdf / .docx / .txt et envoi par email",
  "Historique illimité",
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-8 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--color-border) glass px-4 py-1.5 text-xs font-medium text-(--color-foreground-muted)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--color-primary)" />
            Sans engagement, résiliable à tout moment
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            <span className="text-gradient">Des tarifs simples</span>, sans surprise
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-(--color-foreground-muted)">
            Choisissez le volume de transcription dont vous avez besoin chaque mois.
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`${plan.highlighted ? "glass-strong" : "glass"} relative flex flex-col rounded-3xl p-8`}
            >
              {plan.highlighted && (
                <span className="absolute right-6 top-6 rounded-full bg-(--color-primary) px-3 py-1 text-xs font-semibold text-(--color-on-primary)">
                  Populaire
                </span>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatEuro(plan.price)}
                </span>
                <span className="text-(--color-foreground-muted)">/ mois</span>
              </p>
              <p className="mt-2 text-sm text-(--color-foreground-muted)">{plan.tagline}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
                <li className="flex items-start gap-2.5 font-medium">
                  <CheckIcon />
                  <span>{formatMinutes(plan.includedMinutes)} de transcription par mois</span>
                </li>
                {COMMON_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 flex h-12 items-center justify-center rounded-full px-6 text-base font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-(--color-primary) text-(--color-on-primary) hover:bg-(--color-primary-hover)"
                    : "glass hover:bg-(--color-surface-raised)"
                }`}
              >
                Choisir {plan.name}
              </Link>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 pt-6 text-center sm:px-6">
          <p className="text-sm text-(--color-foreground-muted)">
            Le quota se renouvelle à chaque mensualité. Vous pouvez changer de formule à tout moment
            depuis votre compte.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 shrink-0 text-(--color-primary)"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
