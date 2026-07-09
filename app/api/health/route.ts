import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic de déploiement : présence des variables d'env (booléens
 * uniquement, jamais les valeurs) et chargement des dépendances natives.
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    FIREBASE_ADMIN_PROJECT_ID: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
    FIREBASE_ADMIN_CLIENT_EMAIL: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    FIREBASE_ADMIN_PRIVATE_KEY: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
  };

  let ffmpeg = "ok";
  try {
    const mod = await import("ffmpeg-static");
    const binaryPath = mod.default as string | null;
    if (!binaryPath) ffmpeg = "no binary path";
    else {
      const fs = await import("node:fs");
      if (!fs.existsSync(binaryPath)) ffmpeg = "binary missing at runtime";
    }
  } catch (e) {
    ffmpeg = `import failed: ${e instanceof Error ? e.message.slice(0, 120) : "?"}`;
  }

  let admin = "ok";
  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    adminDb();
  } catch (e) {
    admin = `init failed: ${e instanceof Error ? e.message.slice(0, 120) : "?"}`;
  }

  let transcribeModule = "ok";
  try {
    await import("@/lib/audio");
    await import("@/lib/fetch-source");
    await import("@/lib/openai");
  } catch (e) {
    transcribeModule = `import failed: ${e instanceof Error ? e.message.slice(0, 160) : "?"}`;
  }

  return NextResponse.json({ env, ffmpeg, admin, transcribeModule });
}
