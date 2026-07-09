"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

const VoiceOrb = dynamic(() => import("@/components/VoiceOrb"), { ssr: false });

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Fallback statique respectant prefers-reduced-motion et le chargement WebGL. */
function OrbFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="h-56 w-56 rounded-full bg-gradient-to-br from-[#35e0a1] to-[#0f7a5a] opacity-70 blur-[2px] shadow-[0_0_120px_40px_rgba(53,224,161,0.35)]" />
    </div>
  );
}

export function VoiceOrbScene() {
  // false côté serveur → pas de mismatch (VoiceOrb est ssr:false de toute façon).
  const reducedMotion = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (reducedMotion) {
    return <OrbFallback />;
  }

  return <VoiceOrb />;
}
