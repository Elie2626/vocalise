import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin volontairement absent : chargé en externe, son require()
  // de jose (ESM) plante sur Vercel (ERR_REQUIRE_ESM) — bundlé, l'interop passe.
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/transcribe": ["./node_modules/ffmpeg-static/**"],
  },
};

export default nextConfig;
