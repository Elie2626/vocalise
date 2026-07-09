import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VoiceOrbScene } from "@/components/VoiceOrbScene";

const FEATURES = [
  {
    title: "Tous vos formats",
    description:
      "Vocaux WhatsApp, mémos audio, vidéos MP4 — déposez le fichier, on s'occupe du reste.",
    icon: UploadIcon,
  },
  {
    title: "Transcription précise",
    description:
      "Propulsée par l'IA, avec une excellente reconnaissance du français et des accents.",
    icon: WaveIcon,
  },
  {
    title: "Résumé automatique",
    description:
      "Obtenez en plus un résumé court généré automatiquement à partir du texte transcrit.",
    icon: SparkleIcon,
  },
  {
    title: "Horodatage par segment",
    description:
      "Retrouvez facilement à quel moment de l'audio correspond chaque passage du texte.",
    icon: ClockIcon,
  },
  {
    title: "Export flexible",
    description: "Copiez le texte, ou téléchargez-le en .txt ou .docx en un clic.",
    icon: DownloadIcon,
  },
  {
    title: "Historique sécurisé",
    description:
      "Toutes vos transcriptions restent accessibles depuis votre compte, en privé.",
    icon: LockIcon,
  },
];

const STEPS = [
  {
    title: "Déposez votre fichier",
    description: "Glissez-déposez un vocal ou une vidéo depuis votre téléphone ou ordinateur.",
  },
  {
    title: "L'IA transcrit",
    description: "La transcription, le résumé et l'horodatage sont générés automatiquement.",
  },
  {
    title: "Récupérez le texte",
    description: "Copiez le résultat ou téléchargez-le en .txt / .docx, quand vous voulez.",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">
        <section className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          {/* Scène 3D en arrière-plan du hero */}
          <div className="pointer-events-none absolute inset-0 -z-0 mx-auto max-w-3xl">
            <VoiceOrbScene />
          </div>
          {/* Voile pour garantir la lisibilité du texte au-dessus de l'orbe */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_60%_50%_at_center,rgba(8,11,22,0.72),transparent_75%)]"
          />

          <div className="relative z-10 flex flex-col items-center [text-shadow:0_2px_24px_rgba(8,11,22,0.85)]">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-(--color-border) glass px-4 py-1.5 text-xs font-medium text-(--color-foreground-muted)">
              <span className="h-1.5 w-1.5 rounded-full bg-(--color-primary)" />
              Transcription IA · français natif
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              <span className="text-gradient">Vos vocaux et vidéos,</span>
              <br />
              transformés en texte écrit
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-(--color-foreground-muted)">
              Déposez un message vocal WhatsApp, un mémo audio ou une vidéo : récupérez une
              transcription propre, avec résumé automatique et horodatage.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="flex h-12 w-full items-center justify-center rounded-full bg-(--color-primary) px-7 text-base font-semibold text-(--color-on-primary) shadow-[0_0_40px_-8px_rgba(53,224,161,0.6)] transition-all hover:bg-(--color-primary-hover) hover:shadow-[0_0_50px_-6px_rgba(53,224,161,0.75)] sm:w-auto"
              >
                Essayer gratuitement
              </Link>
              <a
                href="#comment-ca-marche"
                className="glass flex h-12 w-full items-center justify-center rounded-full px-7 text-base font-medium transition-colors hover:bg-(--color-surface-raised) sm:w-auto"
              >
                Comment ça marche
              </a>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Tout ce qu&apos;il faut pour vos transcriptions
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="glass rounded-2xl p-6 transition-transform hover:-translate-y-1"
                >
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--color-primary)/15 text-(--color-primary) ring-1 ring-(--color-primary)/30"
                  >
                    <Icon />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-(--color-foreground-muted)">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="comment-ca-marche" className="py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Comment ça marche
            </h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-(--color-primary) text-base font-semibold text-(--color-on-primary) shadow-[0_0_30px_-6px_rgba(53,224,161,0.6)]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-(--color-foreground-muted)">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="glass-strong mx-auto max-w-3xl overflow-hidden rounded-3xl px-6 py-14 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Prêt à gagner du temps ?
            </h2>
            <p className="mt-3 text-(--color-foreground-muted)">
              Créez votre compte gratuitement et transcrivez votre premier fichier en quelques
              minutes.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-(--color-primary) px-7 text-base font-semibold text-(--color-on-primary) shadow-[0_0_40px_-8px_rgba(53,224,161,0.6)] transition-all hover:bg-(--color-primary-hover)"
            >
              Créer mon compte
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h2l2-6 3 14 3-10 2 4h2" />
      <path d="M19 12h3" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
