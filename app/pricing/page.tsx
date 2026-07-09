import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_INCLUDED_MINUTES,
  USAGE_PRICE_PER_MINUTE,
  FREE_TRIAL_MINUTES,
  USAGE_TABLE,
  formatEuro,
} from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Tarifs — Vocalise",
  description:
    "Essai gratuit, abonnement mensuel ou paiement à l'utilisation : choisissez la formule Vocalise qui vous convient.",
};

const includedHours = Math.round(SUBSCRIPTION_INCLUDED_MINUTES / 60);

const SUBSCRIPTION_FEATURES = [
  `${includedHours} h de transcription incluses chaque mois`,
  "Résumé automatique et horodatage",
  "Détection & traduction multilingue",
  "Export .pdf / .docx / .txt",
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
            {`${FREE_TRIAL_MINUTES} minutes offertes à l'inscription`}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            <span className="text-gradient">Des tarifs simples</span>, sans surprise
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-(--color-foreground-muted)">
            Commencez gratuitement. Ensuite, choisissez l&apos;abonnement si vous transcrivez
            souvent, ou payez seulement ce que vous utilisez.
          </p>
        </section>

        <section className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
          {/* Abonnement */}
          <div className="glass-strong relative flex flex-col rounded-3xl p-8">
            <span className="absolute right-6 top-6 rounded-full bg-(--color-primary) px-3 py-1 text-xs font-semibold text-(--color-on-primary)">
              Populaire
            </span>
            <h2 className="text-lg font-semibold">Abonnement</h2>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">
                {formatEuro(SUBSCRIPTION_PRICE)}
              </span>
              <span className="text-(--color-foreground-muted)">/ mois</span>
            </p>
            <p className="mt-2 text-sm text-(--color-foreground-muted)">
              Idéal pour un usage régulier. Au-delà des {includedHours} h incluses, vous basculez
              au tarif à l&apos;utilisation jusqu&apos;au renouvellement.
            </p>

            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {SUBSCRIPTION_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-8 flex h-12 items-center justify-center rounded-full bg-(--color-primary) px-6 text-base font-semibold text-(--color-on-primary) shadow-[0_0_40px_-8px_rgba(53,224,161,0.6)] transition-colors hover:bg-(--color-primary-hover)"
            >
              Commencer l&apos;essai gratuit
            </Link>
          </div>

          {/* À l'utilisation */}
          <div className="glass flex flex-col rounded-3xl p-8">
            <h2 className="text-lg font-semibold">À l&apos;utilisation</h2>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">
                {formatEuro(USAGE_PRICE_PER_MINUTE)}
              </span>
              <span className="text-(--color-foreground-muted)">/ minute</span>
            </p>
            <p className="mt-2 text-sm text-(--color-foreground-muted)">
              Aucun engagement. Vous ne payez que les minutes réellement transcrites.
            </p>

            <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-(--color-border)">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--color-border) text-left text-(--color-foreground-muted)">
                    <th className="px-4 py-2.5 font-medium">Durée</th>
                    <th className="px-4 py-2.5 text-right font-medium">Prix</th>
                  </tr>
                </thead>
                <tbody>
                  {USAGE_TABLE.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i < USAGE_TABLE.length - 1 ? "border-b border-(--color-border)" : ""}
                    >
                      <td className="px-4 py-2.5">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {formatEuro(row.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Link
              href="/signup"
              className="glass mt-8 flex h-12 items-center justify-center rounded-full px-6 text-base font-medium transition-colors hover:bg-(--color-surface-raised)"
            >
              Créer un compte
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 pt-6 text-center sm:px-6">
          <p className="text-sm text-(--color-foreground-muted)">
            Les prix à l&apos;utilisation correspondent à 1,5× notre coût de traitement. Une minute
            d&apos;audio = une minute facturée, résumé, horodatage et traduction inclus.
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
