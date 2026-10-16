import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin volontairement absent : chargé en externe, son require()
  // de jose (ESM) plante sur Vercel (ERR_REQUIRE_ESM) — bundlé, l'interop passe.
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/transcribe": ["./node_modules/ffmpeg-static/**"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Empêche l'affichage du site dans une iframe tierce (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Micro autorisé uniquement pour ce site (mode dictée), le reste coupé.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
