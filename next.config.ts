import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static", "firebase-admin"],
  outputFileTracingIncludes: {
    "/api/transcribe": ["./node_modules/ffmpeg-static/**"],
  },
};

export default nextConfig;
